import { CONTACT_FORM_DEFINITION, SITE_CONTENT_KEYS, type SiteContentRow } from '@aklapper/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

import { SiteContentEditorPanel } from './SiteContentEditorPanel';

const SITE_ROWS: SiteContentRow[] = [
  {
    key: SITE_CONTENT_KEYS.portalHome,
    markdownBody: '# Home corpus note',
    metadataJson: {
      tuiTitle: 'launcher :: home',
      tuiBadge: { source: 'portal', state: 'ready', label: 'Ready' },
      heading: 'Andrew Klapper',
      description: 'Principal full-stack engineer.',
      actions: [{ label: 'Open Menu', to: '/menu', variant: 'primary' }],
    },
    updatedAt: '2026-11-24T22:00:00.000Z',
  },
  {
    key: SITE_CONTENT_KEYS.portalChrome,
    markdownBody: '# Chrome note',
    metadataJson: {
      pageTitle: 'Andrew Klapper',
      brandLabel: 'andrew-k.us',
      shortcutHint: 'Press m for menu',
      statusBadge: { source: 'portal', state: 'ready', label: 'Online' },
      footerText: 'Built with Solar Forge',
      footerLinkLabel: 'GitHub',
      footerLinkUrl: 'https://github.com/AndrewK4758',
      maintenanceModeDefault: false,
    },
    updatedAt: '2026-11-24T22:00:00.000Z',
  },
  {
    key: SITE_CONTENT_KEYS.portalContact,
    markdownBody: '# Contact note',
    metadataJson: {
      windowTitle: 'Contact',
      statusBadge: { source: 'contact', state: 'ready', label: 'PG19' },
      description: 'Send a direct message.',
      form: CONTACT_FORM_DEFINITION,
    },
    updatedAt: '2026-11-24T22:00:00.000Z',
  },
  {
    key: 'custom-banner',
    markdownBody: '# Custom note',
    metadataJson: { bannerText: 'Custom notice' },
    updatedAt: '2026-11-24T22:00:00.000Z',
  },
];

function renderPanel(rows: readonly SiteContentRow[] = SITE_ROWS) {
  const Stub = createRoutesStub([
    {
      path: '/cms',
      Component: () => <SiteContentEditorPanel siteContents={rows} />,
    },
  ]);
  return render(<Stub initialEntries={['/cms']} />);
}

describe('SiteContentEditorPanel', () => {
  it('renders structured Form controls, Qdrant corpus label, and live split preview outside the form', () => {
    const { container } = renderPanel();

    expect(screen.getByLabelText('Qdrant RAG Corpus Note (Markdown)')).toBeTruthy();
    expect(screen.getByText(/LoadCorpusDocs/i)).toBeTruthy();

    const headingInput = screen.getByLabelText(/^Heading/i);
    fireEvent.change(headingInput, { target: { value: 'Live Preview Updated Heading' } });

    const preview = screen.getByLabelText('Live site content preview');
    expect(within(preview).getByText('Live Preview Updated Heading')).toBeTruthy();

    // Preview must mount outside the editor <form> to avoid nested forms
    const forms = container.querySelectorAll('form');
    expect(forms).toHaveLength(1);
    expect(forms[0]?.contains(preview)).toBe(false);
  });

  it('toggles Desktop/Mobile preview widths and Show/Hide preview without losing unsaved edits', () => {
    renderPanel();

    const headingInput = screen.getByLabelText(/^Heading/i) as HTMLInputElement;
    fireEvent.change(headingInput, { target: { value: 'Unsaved Draft Copy' } });

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    const canvas = document.querySelector('[data-preview-viewport="mobile"]');
    expect(canvas).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Preview' }));
    expect(screen.queryByLabelText('Live site content preview')).toBeNull();
    expect(headingInput.value).toBe('Unsaved Draft Copy');
  });

  it('supports synchronized Form | Raw JSON mode switching and invalid JSON guard', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText(/^Heading/i), { target: { value: 'Synced Title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));

    const jsonBox = screen.getByLabelText('Raw Metadata JSON') as HTMLTextAreaElement;
    expect(jsonBox.value).toContain('Synced Title');

    fireEvent.change(jsonBox, { target: { value: '{ broken json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Form' }));

    expect(screen.getByRole('alert').textContent).toMatch(/Invalid JSON/i);
    expect((screen.getByLabelText('Raw Metadata JSON') as HTMLTextAreaElement).value).toBe(
      '{ broken json',
    );
  });

  it('shows live client-side Zod validation errors and disables Save until fixed', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /portal-chrome/i }));
    const urlInput = screen.getByLabelText(/Footer Link Url/i);
    fireEvent.change(urlInput, { target: { value: 'not-a-url' } });

    expect(urlInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Site Content' })).toHaveProperty(
      'disabled',
      true,
    );

    fireEvent.change(urlInput, { target: { value: 'https://andrew-k.us' } });
    expect(urlInput.getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByRole('button', { name: 'Save Site Content' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('supports portal-contact FormDefinitionBuilder mutations and unknown-key Raw JSON fallback', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /portal-contact/i }));
    expect(screen.getByText('Contact Form Builder')).toBeTruthy();

    const addFieldButtons = screen.getAllByRole('button', { name: '+ Add Field' });
    expect(addFieldButtons.length).toBeGreaterThan(0);
    fireEvent.click(addFieldButtons[0]!);
    const hiddenJson = document.querySelector(
      'input[name="metadataJson"]',
    ) as HTMLInputElement | null;
    expect(hiddenJson?.value).toContain('"kind": "field"');

    fireEvent.click(screen.getByRole('button', { name: /custom-banner/i }));
    expect(screen.getByText(/custom key/i)).toBeTruthy();
    expect(screen.getByLabelText('Raw Metadata JSON')).toBeTruthy();
  });
});
