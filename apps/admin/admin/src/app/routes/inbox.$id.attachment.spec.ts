import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  openAdminContactAttachmentStreamViaGrpc: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('../admin-ops.server', async () => {
  const actual = await vi.importActual<typeof import('../admin-ops.server')>('../admin-ops.server');
  return {
    ...actual,
    requireAdminSession: (...args: unknown[]) => mocks.requireAdminSession(...args),
  };
});

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    openAdminContactAttachmentStreamViaGrpc: (...args: unknown[]) =>
      mocks.openAdminContactAttachmentStreamViaGrpc(...args),
  };
});

import { sanitizeDownloadFilename } from '../admin-ops.server';
import { loader } from './inbox.$id.attachment';

const TEST_SESSION = {
  status: {
    authenticated: true,
    session: {
      sessionId: '11111111-1111-4111-8111-111111111111',
      role: 'admin',
      handle: 'admin',
      expiresAt: '2026-12-31T00:00:00.000Z',
    },
    totpEnabled: false,
    passkeyCount: 0,
  },
  session: {
    sessionId: '11111111-1111-4111-8111-111111111111',
    role: 'admin',
    handle: 'admin',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
};

function makeArgs(id: string) {
  const context = new RouterContextProvider();
  context.set(requestContextKey, {
    correlationId: 'corr-att-test',
    logger: {
      info: vi.fn<(...args: unknown[]) => void>(),
      warn: vi.fn<(...args: unknown[]) => void>(),
      error: vi.fn<(...args: unknown[]) => void>(),
    },
    serviceName: 'admin-ssr',
    signal: new AbortController().signal,
  });
  const url = `http://localhost:4301/inbox/${id}/attachment`;
  return {
    request: new Request(url),
    url: new URL(url),
    pattern: '/inbox/:id/attachment',
    unstable_pattern: '/inbox/:id/attachment',
    params: { id },
    context,
  };
}

describe('inbox.$id.attachment loader & Content-Disposition sanitization', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns strictly printable ASCII from sanitizeDownloadFilename across Unicode and injection inputs', () => {
    const cases = [
      ['Resume—2026.pdf', 'Resume_2026.pdf'],
      ['履歴書.pdf', 'attachment.pdf'],
      ['../../evil\r\n"foo";bar\x00.txt', 'evilfoobar.txt'],
      ['   \r\n\0   ', 'attachment.bin'],
    ] as const;

    for (const [input, expected] of cases) {
      const sanitized = sanitizeDownloadFilename(input);
      expect(sanitized).toBe(expected);
      expect(/^[\x20-\x7e]+$/.test(sanitized)).toBe(true);
      expect(/["\\/;<>|:*?\r\n\0]/.test(sanitized)).toBe(false);
    }
  });

  it('streams Unicode filenames with RFC 5987 filename* without ByteString 500 crashes', async () => {
    mocks.requireAdminSession.mockResolvedValue(TEST_SESSION);

    const unicodeCases = [
      {
        filename: 'Resume—2026.pdf',
        expectedDisposition:
          'attachment; filename="Resume_2026.pdf"; filename*=UTF-8\'\'Resume%E2%80%942026.pdf',
      },
      {
        filename: '履歴書.pdf',
        expectedDisposition:
          'attachment; filename="attachment.pdf"; filename*=UTF-8\'\'%E5%B1%A5%E6%AD%B4%E6%9B%B8.pdf',
      },
      {
        filename: 'dir/sub\\bad\r\n"quote";semi\x00.pdf',
        expectedDisposition: 'attachment; filename="badquotesemi.pdf"',
      },
      {
        filename: `${'a'.repeat(127)}📄.pdf`,
        expectedDisposition: `attachment; filename="${'a'.repeat(127)}_"; filename*=UTF-8''${'a'.repeat(127)}%F0%9F%93%84`,
      },
      {
        filename: `${'Resume_2026_'.repeat(10)}1234567𠮷.pdf`,
        expectedDisposition: `attachment; filename="${'Resume_2026_'.repeat(10)}1234567_"; filename*=UTF-8''${'Resume_2026_'.repeat(10)}1234567%F0%A0%AE%B7`,
      },
      {
        filename: '\uD83Dresume\uDC00.pdf',
        expectedDisposition: 'attachment; filename="resume.pdf"',
      },
    ];

    for (const tc of unicodeCases) {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
          controller.close();
        },
      });
      mocks.openAdminContactAttachmentStreamViaGrpc.mockResolvedValueOnce({
        metadata: {
          id: 'sub-unicode',
          filename: tc.filename,
          mimeType: 'application/pdf',
          sizeBytes: 4,
          sha256: 'a'.repeat(64),
        },
        body,
      });

      const res = await loader(makeArgs('sub-unicode') as never);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toBe(tc.expectedDisposition);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      const buf = new Uint8Array(await res.arrayBuffer());
      expect(Array.from(buf)).toEqual([0x25, 0x50, 0x44, 0x46]);
    }
  });

  it('cancels streamed.body and returns a classified error response when Response header construction throws', async () => {
    mocks.requireAdminSession.mockResolvedValue(TEST_SESSION);
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    mocks.openAdminContactAttachmentStreamViaGrpc.mockResolvedValueOnce({
      metadata: {
        id: 'sub-bad-mime',
        filename: 'safe.pdf',
        // Non-ByteString character in mimeType forces new Response(...) to throw TypeError.
        mimeType: 'application/pdf—invalid',
        sizeBytes: 12,
        sha256: 'b'.repeat(64),
      },
      body,
    });

    const res = await loader(makeArgs('sub-bad-mime') as never);
    expect(cancelled).toBe(true);
    expect(res.status).toBe(500);
    expect(res.headers.get('X-Correlation-Id')).toBe('corr-att-test');
    const payload = (await res.json()) as { code?: string };
    expect(payload.code).toBe('ERR_INTERNAL');
  });
});
