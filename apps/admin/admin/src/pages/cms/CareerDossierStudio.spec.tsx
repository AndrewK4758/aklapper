import { SITE_CONTENT_KEYS, type QdrantHealthStatus } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleCareerDossierIntent } from '../../app/career-dossier-actions.server';
import { dispatchAdminCmsIntent } from '../../app/cms-actions.server';
import { parseCareerDossierMarkdown } from './careerDossierMarkdown';
import { CareerDossierSection } from './CareerDossierSection';
import { createInitialSiteContentDraftState } from './siteContentDraftState';
import { VisitorLensListEditor } from './VisitorLensListEditor';

const QDRANT_FIXTURE: QdrantHealthStatus = {
  online: true,
  collection: 'portfolio_docs',
  pointsCount: 12,
  status: 'green',
  provider: 'local',
};

describe('Admin CMS Career Dossier Studio, VisitorLensListEditor & 409/400 action handling', () => {
  const originalAiAskUrl = process.env['AI_ASK_URL'];

  afterEach(() => {
    if (originalAiAskUrl === undefined) delete process.env['AI_ASK_URL'];
    else process.env['AI_ASK_URL'] = originalAiAskUrl;
    vi.restoreAllMocks();
  });

  it('parses pasted markdown headings into structured sections and renders live chunk + ValidationGatePreview findings', async () => {
    const parsed = parseCareerDossierMarkdown(
      [
        '# Cloud Platform Modernization',
        'Slug: cloud-platform-mod',
        'Kind: architecture',
        'Domain: Enterprise Cloud',
        'Role: Principal Architect',
        'Timeframe: 2023-2026',
        'Skills: Go, TypeScript, PG19, K8s',
        '',
        'Architected streaming SSR and Go services.',
        '',
        '## Database Reliability',
        'Reversible migrations and FOR UPDATE quota safety.',
        '',
        '## Hybrid Retrieval',
        'Combined PostgreSQL tsvector with Qdrant cosine search.',
      ].join('\n'),
    );

    expect(parsed.slug).toBe('cloud-platform-mod');
    expect(parsed.kind).toBe('architecture');
    expect(parsed.skills).toEqual(['Go', 'TypeScript', 'PG19', 'K8s']);
    expect(parsed.sections).toHaveLength(2);

    const Stub = createRoutesStub([
      {
        path: '/cms',
        Component: () => (
          <CareerDossierSection
            dossiers={[]}
            qdrant={QDRANT_FIXTURE}
            sanitizationFindings={[
              {
                ruleId: 'denylist.term_1',
                category: 'denylist',
                field: 'summaryBody',
                location: 'line:1',
              },
            ]}
          />
        ),
      },
    ]);

    render(<Stub initialEntries={['/cms']} />);
    const gate = await screen.findByTestId('dossier-validation-gate');
    expect(gate.getAttribute('data-gate-status')).toBe('fail');
    expect(gate.textContent).toContain('denylist.term_1');

    const pasteArea = screen.getByLabelText('Markdown paste import');
    fireEvent.change(pasteArea, {
      target: {
        value:
          '# New Architecture\n\nSummary text.\n\n## Section One\nFirst body.\n\n## Section Two\nSecond body.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse Markdown into Form' }));
    expect(screen.getByText('3 chunks')).toBeTruthy();
    expect(screen.getByTestId('dossier-chunk-preview').textContent).toContain('Section One');
  });

  it('hydrates legacy 6-field portal-ask rows with default visitorLenses and edits lenses via VisitorLensListEditor', () => {
    const init = createInitialSiteContentDraftState(
      {
        key: SITE_CONTENT_KEYS.portalAsk,
        markdownBody: '',
        metadataJson: {
          windowTitle: 'Ask Portfolio',
          statusBadge: { source: 'svc-ai-ask', state: 'idle', label: 'Ready' },
          description: 'Ask grounded questions.',
          starterQuestions: ['What stack powers this portfolio?'],
          jdPlaceholder: 'Paste JD...',
          abstentionNotice: 'Grounded answers only.',
        },
        updatedAt: '2026-11-25T00:00:00.000Z',
      },
      undefined,
      () => {},
    );

    expect(Array.isArray(init.state.draftObject['visitorLenses'])).toBe(true);
    expect(init.state.draftObject['qaTabLabel']).toBe('Ask Andrew Assistant');

    const changes: Array<{ path: readonly (string | number)[]; value: unknown }> = [];
    render(
      <VisitorLensListEditor
        fieldKey='visitorLenses'
        label='Visitor Lenses'
        value={init.state.draftObject['visitorLenses']}
        issuesByPath={{}}
        onChange={(path, value) => {
          changes.push({ path, value });
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Add Visitor Lens' }));
    expect(changes).toHaveLength(1);
    expect(changes[0]?.path).toEqual(['visitorLenses']);
  });

  it('preserves HTTP 409 ERR_CONSTRAINT on contended reindex and rejects binary/oversized .md uploads with HTTP 400', async () => {
    const logger = {
      info: vi.fn<() => void>(),
      warn: vi.fn<() => void>(),
      error: vi.fn<() => void>(),
    };

    process.env['AI_ASK_URL'] = 'http://127.0.0.1:18083';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'ERR_CONSTRAINT',
          message: 'A portfolio reindex is already in progress.',
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    );

    const reindexForm = new FormData();
    reindexForm.set('intent', 'reindex-qdrant');
    const conflictOutcome = await dispatchAdminCmsIntent(
      'reindex-qdrant',
      reindexForm,
      'corr-409',
      logger,
      'aklapper',
    );
    expect(conflictOutcome.status).toBe(409);
    expect(conflictOutcome.payload.code).toBe('ERR_CONSTRAINT');

    const binaryForm = new FormData();
    binaryForm.set('intent', 'import-career-dossier-files');
    binaryForm.append(
      'markdownFiles',
      new File([new Uint8Array([0x00, 0xff, 0xfe, 0x00])], 'bad.md', { type: 'text/markdown' }),
    );
    const binaryOutcome = await handleCareerDossierIntent(
      'import-career-dossier-files',
      binaryForm,
      {
        correlationId: 'corr-bin-400',
        logger,
        adminActor: 'aklapper',
      },
    );
    expect(binaryOutcome.status).toBe(400);
    expect(binaryOutcome.payload.code).toBe('ERR_VALIDATION');

    const oversizedForm = new FormData();
    oversizedForm.set('intent', 'import-career-dossier-files');
    oversizedForm.append(
      'markdownFiles',
      new File(['a'.repeat(300 * 1024)], 'huge.md', { type: 'text/markdown' }),
    );
    const oversizedOutcome = await handleCareerDossierIntent(
      'import-career-dossier-files',
      oversizedForm,
      {
        correlationId: 'corr-big-400',
        logger,
        adminActor: 'aklapper',
      },
    );
    expect(oversizedOutcome.status).toBe(400);
    expect(oversizedOutcome.payload.code).toBe('ERR_VALIDATION');
  });
});
