import { getPrerenderPortalAboutData } from '@aklapper/db';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PortalAboutPage } from './PortalAboutPage';

describe('PortalAboutPage', () => {
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

    // Privacy hygiene: zero References, personal phone numbers, or residential ZIP codes
    const renderedText = container.textContent ?? '';
    expect(renderedText).not.toMatch(/\bReferences\b/i);
    expect(renderedText).not.toMatch(/(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}/);
    expect(renderedText).not.toMatch(/\bGA\s+\d{5}\b/);
    expect(renderedText).not.toContain('30008');
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
});
