import {
  type AskSource,
  type AskSuggestedLink,
  type PrivacySanitizationFinding,
  PortalAskContentSchema,
  SITE_CONTENT_KEYS,
} from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CitationSourceList,
  DeepLinkCardRow,
  PaneNavigationContext,
  SiteContentPreviewCanvas,
  SuggestionChipRow,
  ValidationGatePreview,
} from '../src/index';

describe('@aklapper/ui assistant & validation primitives', () => {
  it('composes SuggestionChipRow, CitationSourceList, DeepLinkCardRow (with PaneLink dock nav), and ValidationGatePreview', () => {
    const selectedIds: string[] = [];
    const pushSpy = vi.fn<(to: string) => void>();

    const sources: AskSource[] = [
      {
        id: 'dossier:platform#0',
        title: 'Cloud Platform Modernization',
        sectionHeading: 'Database Reliability',
        category: 'architecture',
        score: 0.87,
        snippet: 'Reversible PostgreSQL 19 migrations with atomic FOR UPDATE locks.',
      },
      {
        id: 'dossier:go#1',
        title: 'Go Microservices',
        sectionHeading: 'gRPC & SSE Transport',
        category: 'backend',
        score: 0.72,
        snippet: 'Streaming Go handlers on GKE Autopilot.',
      },
    ];

    const links: AskSuggestedLink[] = [
      {
        route: '/cadence',
        label: 'CADENCE Builder',
        reason: 'Inspect interactive workflow sandbox.',
      },
      { route: '/contact', label: 'Contact', reason: 'Reach Andrew directly.' },
    ];

    render(
      <PaneNavigationContext.Provider
        value={{
          paneId: 'pane-1',
          ttyNumber: 1,
          isActive: true,
          isSinglePane: false,
          docked: true,
          stack: ['/ask'],
          canGoBack: false,
          push: pushSpy,
          openInSplit: vi.fn<(to: string) => void>(),
          openInTab: vi.fn<(to: string) => void>(),
          pop: vi.fn<() => void>(),
          exitTui: vi.fn<() => void>(),
        }}
      >
        <SuggestionChipRow
          ariaLabel='Visitor lenses'
          selectedId='hiring-manager'
          testIdPrefix='lens'
          items={[
            { id: 'hiring-manager', label: 'Hiring Manager', description: 'Leadership & delivery' },
            { id: 'engineering-peer', label: 'Engineering Peer', description: 'Systems & code' },
          ]}
          onSelect={item => {
            selectedIds.push(item.id);
          }}
        />
        <CitationSourceList heading='Grounded Sources' sources={sources} testId='citations' />
        <DeepLinkCardRow heading='Explore Related Sections' links={links} testId='deep-links' />
        <ValidationGatePreview
          passed={true}
          findings={[]}
          chunkCount={3}
          publishStatus='draft'
          testId='gate-preview'
        />
      </PaneNavigationContext.Provider>,
    );

    expect(screen.getByTestId('lens-hiring-manager').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('lens-engineering-peer'));
    expect(selectedIds).toEqual(['engineering-peer']);

    // Expand first citation card and check section heading, category, percentage, snippet
    const trigger = screen.getByRole('button', { name: /Cloud Platform Modernization/i });
    fireEvent.click(trigger);
    expect(screen.getByText('Database Reliability')).toBeTruthy();
    expect(screen.getByText('architecture')).toBeTruthy();
    expect(screen.getByText(/Relevance 87%/)).toBeTruthy();
    expect(screen.getByText(/atomic FOR UPDATE locks/)).toBeTruthy();

    // DeepLinkCardRow renders semantic <nav>/<div> (zero <ul>) and delegates to PaneLink context
    const nav = screen.getByTestId('deep-links');
    expect(nav.tagName).toBe('NAV');
    expect(nav.querySelectorAll('ul')).toHaveLength(0);
    fireEvent.click(screen.getByRole('link', { name: /CADENCE Builder/i }));
    expect(pushSpy).toHaveBeenCalledWith('/cadence');

    expect(screen.getByTestId('gate-preview').getAttribute('data-gate-status')).toBe('pass');
    expect(screen.getByText('3 chunks')).toBeTruthy();
  });

  it('omits empty CitationSourceList, drops disallowed deep-link routes with UNSOUND_CONDITION log, and renders safe ValidationGatePreview findings', () => {
    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });

    const findings: PrivacySanitizationFinding[] = [
      {
        ruleId: 'denylist.term_1',
        category: 'denylist',
        field: 'summaryBody',
        location: 'line:2',
      },
      {
        ruleId: 'secret.aws_access_key',
        category: 'secret',
        field: 'sections[0].body',
        location: 'line:4',
      },
    ];

    try {
      const mixedLinks = [
        { route: '/agensi', label: 'Agensi Skills', reason: 'Published AI skills' },
        {
          route: 'https://evil.example/phish',
          label: 'Phishing',
          reason: 'Should be dropped',
        },
      ] as unknown as readonly AskSuggestedLink[];

      render(
        <div>
          <CitationSourceList heading='Empty Citations' sources={[]} testId='empty-citations' />
          <DeepLinkCardRow heading='Links' links={mixedLinks} testId='filtered-links' />
          <ValidationGatePreview
            passed={false}
            findings={findings}
            chunkCount={2}
            publishStatus='draft'
            testId='blocked-preview'
          />
        </div>,
      );

      expect(screen.queryByTestId('empty-citations')).toBeNull();
      const filteredNav = screen.getByTestId('filtered-links');
      expect(filteredNav.querySelectorAll('a')).toHaveLength(1);
      expect(filteredNav.textContent).toContain('/agensi');
      expect(filteredNav.textContent).not.toContain('evil.example');
      expect(warnLogs.join('\n')).toContain('ai_ask.deeplink.disallowed_route_rejected');
      expect(warnLogs.join('\n')).toContain('UNSOUND_CONDITION');

      const preview = screen.getByTestId('blocked-preview');
      expect(preview.getAttribute('data-gate-status')).toBe('fail');
      expect(preview.textContent).toContain('denylist.term_1');
      expect(preview.textContent).toContain('secret.aws_access_key');
      expect(preview.textContent).toContain('summaryBody');
      expect(preview.textContent).toContain('line:2');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('renders legacy 6-field site_content portal-ask rows cleanly in SiteContentPreviewCanvas with hydrated defaults', () => {
    const legacySixField = {
      windowTitle: 'Ask Portfolio',
      statusBadge: { source: 'qdrant', state: 'ready', label: 'Grounded' },
      description: 'Ask grounded questions.',
      starterQuestions: ['What stack powers this portfolio?'],
      jdPlaceholder: 'Paste job description...',
      abstentionNotice: 'Answers stay strictly grounded.',
    };
    const parsed = PortalAskContentSchema.parse(legacySixField);

    render(
      <SiteContentPreviewCanvas
        contentKey={SITE_CONTENT_KEYS.portalAsk}
        metadata={legacySixField}
        viewport='desktop'
      />,
    );

    expect(screen.getByText(new RegExp(parsed.qaTabLabel))).toBeTruthy();
    expect(screen.getByText(new RegExp(parsed.jdTabLabel))).toBeTruthy();
    expect(screen.getByText(/Hiring Manager/)).toBeTruthy();
    expect(screen.getByText(new RegExp(parsed.contactCtaLabel))).toBeTruthy();
  });
});
