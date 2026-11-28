import type { AnalyticsBatch } from '@aklapper/core';
import { bootstrapDocumentAnalytics, resetAnalyticsBootstrap } from '@aklapper/core/analytics';
import { getPrerenderPortalAboutData } from '@aklapper/core/prerender';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PortalAboutPage } from './PortalAboutPage';

describe('PortalAboutPage', () => {
  afterEach(() => {
    resetAnalyticsBootstrap();
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });
  it('renders bundled greyscale terminal portrait, sanitized full resume sections, and Services Guide pane links', () => {
    const seeded = getPrerenderPortalAboutData();

    const { container } = render(
      <PortalAboutPage
        content={seeded.content}
        dossiers={seeded.dossiers}
        brandContactEmail={seeded.brandContactEmail}
        onClose={vi.fn<() => void>()}
      />,
    );

    const portrait = screen.getByRole('img', { name: seeded.content.portrait.alt });
    expect(portrait.getAttribute('width')).toBe('440');
    expect(portrait.getAttribute('height')).toBe('520');
    expect(screen.getByText(seeded.content.portrait.caption)).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();
    expect(screen.getByText('Senior Full-Stack & Systems Engineer')).toBeTruthy();
    expect(screen.getByText('Marietta, GA')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'andrew@andrew-k.us' }).getAttribute('href')).toBe(
      'mailto:andrew@andrew-k.us',
    );
    expect(screen.getByRole('link', { name: 'github.com/AndrewK4758' }).getAttribute('href')).toBe(
      'https://github.com/AndrewK4758',
    );
    expect(screen.getByRole('link', { name: 'andrew-k.us' }).getAttribute('href')).toBe(
      'https://andrew-k.us',
    );

    // 5 categorized technical skill groups
    for (const category of [
      'Languages',
      'Frontend & Native UI',
      'Backend & Distributed Systems',
      'Data & AI/ML',
      'Cloud & DevOps',
    ]) {
      expect(screen.getByText(category)).toBeTruthy();
    }

    // Experience entries & Build Technology Group sub-projects
    expect(screen.getByText('Software Engineer | Build Technology Group')).toBeTruthy();
    expect(screen.getByText('Hardware Interfacing Platform')).toBeTruthy();
    expect(screen.getByText('Legacy ERP Modernization')).toBeTruthy();
    expect(screen.getByText('Software Engineer | Gitasy')).toBeTruthy();
    expect(screen.getByText('Owner | Shipping Services & Logistics LLC')).toBeTruthy();

    // 5 Independent R&D & Open-Source Projects
    expect(screen.getByText('CADENCE - Agentic SDLC & Local Coprocessor Framework')).toBeTruthy();
    expect(screen.getByText('Ghostty Union - Native Linux Terminal Emulator')).toBeTruthy();
    expect(screen.getByText('Gemma 4 Dual-GPU Coding Fine-Tuning Pipeline')).toBeTruthy();
    expect(screen.getByText('Distributed AI Document Processing Ecosystem')).toBeTruthy();
    expect(screen.getByText('Antigravity Remote Android & Blitz Contributor')).toBeTruthy();

    // Community & Education
    expect(screen.getByText('Instructor & Mentor | Woodstock Developers Group')).toBeTruthy();
    expect(screen.getByText('Kennesaw State University')).toBeTruthy();
    expect(screen.getByText('Professional Sales (29 credits completed)')).toBeTruthy();

    // Services Guide pane links & Contact CTA
    expect(screen.getByTestId('about-service-link-chat').getAttribute('href')).toBe('/chat');
    expect(screen.getByTestId('about-service-link-agensi').getAttribute('href')).toBe('/agensi');
    expect(screen.getByTestId('about-service-link-cadence').getAttribute('href')).toBe('/cadence');
    expect(screen.getByTestId('about-contact-cta').getAttribute('href')).toBe('/contact');

    // Privacy hygiene: zero contact reference sections, personal phone numbers, or residential ZIP codes
    const renderedText = container.textContent ?? '';
    expect(renderedText).not.toMatch(/\bref(?:erence)?s\b/i);
    expect(renderedText).not.toMatch(/(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}/);
    expect(renderedText).not.toMatch(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/);
    expect(renderedText).not.toMatch(/\b\d{5}-\d{4}\b/);
  });

  it('renders an explicit empty-dossiers notice cleanly when zero published dossiers exist', () => {
    const seeded = getPrerenderPortalAboutData();

    render(
      <PortalAboutPage
        content={seeded.content}
        dossiers={[]}
        brandContactEmail={seeded.brandContactEmail}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('about-dossiers-empty').textContent).toContain(
      seeded.content.emptyDossiersNotice,
    );
    expect(screen.getByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();
    expect(screen.getByText('Kennesaw State University')).toBeTruthy();
    expect(screen.getByTestId('about-service-link-chat')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: seeded.content.experienceHeading })).toBeNull();
    expect(screen.queryByRole('heading', { name: seeded.content.projectsHeading })).toBeNull();
  });

  it('suppresses non-HTTP or credentialed identity links defensively and scopes heading IDs uniquely across split panes', () => {
    const seeded = getPrerenderPortalAboutData();

    const { container } = render(
      <>
        <PortalAboutPage
          content={{
            ...seeded.content,
            identity: {
              ...seeded.content.identity,
              githubUrl: 'javascript:alert(1)',
              websiteUrl: 'https://user:pass@andrew-k.us',
            },
          }}
          dossiers={seeded.dossiers}
          brandContactEmail={seeded.brandContactEmail}
          onClose={vi.fn<() => void>()}
        />
        <PortalAboutPage
          content={seeded.content}
          dossiers={seeded.dossiers}
          brandContactEmail={seeded.brandContactEmail}
          onClose={vi.fn<() => void>()}
        />
      </>,
    );

    const anchors = Array.from(container.querySelectorAll('a'));
    expect(anchors.some(a => (a.getAttribute('href') ?? '').startsWith('javascript:'))).toBe(false);
    expect(anchors.some(a => (a.getAttribute('href') ?? '').includes('user:pass@'))).toBe(false);
    expect(screen.getAllByText(seeded.content.identity.githubLabel)).toHaveLength(2);
    expect(screen.getAllByText(seeded.content.identity.websiteLabel)).toHaveLength(2);

    // Every section heading id must be globally unique when two panes mount side-by-side
    const headingIds = Array.from(container.querySelectorAll('h2[id]')).map(h => h.id);
    expect(headingIds.length).toBeGreaterThanOrEqual(8);
    expect(new Set(headingIds).size).toBe(headingIds.length);
  });

  it('tracks and immediately flushes about_outbound_click for email, github, and website profile links', () => {
    const metaEndpoint = document.createElement('meta');
    metaEndpoint.name = 'aklapper-analytics-endpoint';
    metaEndpoint.content = '/api/analytics/ingest';
    const metaApp = document.createElement('meta');
    metaApp.name = 'aklapper-analytics-app';
    metaApp.content = 'portal';
    document.head.append(metaEndpoint, metaApp);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    bootstrapDocumentAnalytics(document);
    const seeded = getPrerenderPortalAboutData();

    render(
      <PortalAboutPage
        content={seeded.content}
        dossiers={seeded.dossiers}
        brandContactEmail={seeded.brandContactEmail}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: 'andrew@andrew-k.us' }));
    fireEvent.click(screen.getByRole('link', { name: 'github.com/AndrewK4758' }));
    fireEvent.click(screen.getByRole('link', { name: 'andrew-k.us' }));

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const outboundTargets = fetchSpy.mock.calls.flatMap(call => {
      const payload = JSON.parse(String(call[1]?.body)) as AnalyticsBatch;
      return payload.events
        .filter(e => e.name === 'about_outbound_click')
        .map(e => e.metadata?.['target']);
    });
    expect(outboundTargets).toEqual(['email', 'github', 'website']);
  });
});
