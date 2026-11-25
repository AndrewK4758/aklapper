import { once } from 'node:events';
import { createServer } from 'node:http';
import { PassThrough } from 'node:stream';

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { fetchAgensiCreatorCatalog, filterCreatorPublishedSkills } from '../src/agensi.ts';
import { AUTH_LOG_REDACT_PATHS } from '../src/auth.ts';

describe('@aklapper/node-runtime/agensi redaction & snake_case compatibility', () => {
  it('redacts apiKey, agensiApiKey, and x-api-key header in Pino logs via AUTH_LOG_REDACT_PATHS', async () => {
    const chunks: string[] = [];
    const stream = new PassThrough();
    stream.on('data', chunk => {
      chunks.push(Buffer.from(chunk).toString('utf8'));
    });

    const app = Fastify({
      logger: {
        stream,
        redact: { paths: [...AUTH_LOG_REDACT_PATHS], censor: '[REDACTED]' },
      },
    });
    app.get('/agensi-probe', async request => {
      request.log.info(
        {
          apiKey: 'secret-top-level-key',
          agensiApiKey: 'secret-agensi-key',
          nested: { apiKey: 'secret-nested-key' },
        },
        'agensi probe',
      );
      return { ok: true };
    });

    try {
      await app.inject({
        method: 'GET',
        url: '/agensi-probe',
        headers: { 'x-api-key': 'secret-header-api-key' },
      });
    } finally {
      await app.close();
    }

    const logs = chunks.join('');
    expect(logs).not.toContain('secret-top-level-key');
    expect(logs).not.toContain('secret-agensi-key');
    expect(logs).not.toContain('secret-nested-key');
    expect(logs).not.toContain('secret-header-api-key');
    expect(logs).toContain('[REDACTED]');
  });

  it('normalizes snake_case remote fields while enforcing creator_handle and is_published', () => {
    const res = filterCreatorPublishedSkills(
      [
        {
          slug: 'snake-case-skill',
          title: 'Snake Case Skill',
          description: 'Normalized via snake_case aliases.',
          tags: ['agensi'],
          url: 'https://www.agensi.io/skills/snake-case-skill',
          creator_handle: 'aklapper',
          is_published: true,
          sort_order: 4,
        },
        {
          slug: 'snake-case-draft',
          title: 'Draft',
          description: 'Should be rejected.',
          tags: [],
          url: 'https://www.agensi.io/skills/snake-case-draft',
          creator_handle: 'aklapper',
          is_published: false,
        },
      ],
      'aklapper',
    );

    expect(res.rejectedUnpublishedCount).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.name).toBe('Snake Case Skill');
    expect(res.items[0]?.sortOrder).toBe(4);
  });

  it('classifies HTTP 200 stalled-body Abort/TimeoutError as AGENSI_TIMEOUT instead of AGENSI_INVALID_PAYLOAD', async () => {
    const sockets = new Set<import('node:net').Socket>();
    const srv = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{"items":[');
    });
    srv.on('connection', sock => {
      sockets.add(sock);
      sock.once('close', () => sockets.delete(sock));
    });
    srv.listen(0, '127.0.0.1');
    await once(srv, 'listening');
    const addr = srv.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind stalled-body loopback server');
    }

    try {
      const result = await fetchAgensiCreatorCatalog({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        apiPath: '/api/creators/aklapper',
        creatorHandle: 'aklapper',
        timeoutMs: 250,
        maxPages: 1,
        allowedOrigins: ['https://agensi.io'],
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected stalled body read to fail with AGENSI_TIMEOUT');
      }
      expect(result.errorCode).toBe('AGENSI_TIMEOUT');
      expect(result.message).toContain('timed out after 250ms');
    } finally {
      for (const sock of sockets) sock.destroy();
      await new Promise<void>(resolve => srv.close(() => resolve()));
    }
  });
});
