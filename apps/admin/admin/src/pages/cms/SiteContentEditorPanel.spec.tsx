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
  it('renders structured Form controls, defaults preview to closed, and mounts live split preview outside the form on demand', async () => {
    const { container } = renderPanel();

    expect(screen.getByLabelText('Qdrant RAG Corpus Note (Markdown)')).toBeTruthy();
    expect(screen.getByText(/LoadCorpusDocs/i)).toBeTruthy();
    expect(screen.queryByLabelText('Live site content preview')).toBeNull();

    const headingInput = screen.getByLabelText(/^Heading/i);
    fireEvent.change(headingInput, { target: { value: 'Live Preview Updated Heading' } });

    fireEvent.click(screen.getByRole('button', { name: 'Show Preview' }));
    const preview = await screen.findByLabelText('Live site content preview');
    expect(within(preview).getByText('Live Preview Updated Heading')).toBeTruthy();

    // Preview must mount outside the editor <form> to avoid nested forms
    const forms = container.querySelectorAll('form');
    expect(forms).toHaveLength(1);
    expect(forms[0]?.contains(preview)).toBe(false);
  });

  it('toggles Desktop/Mobile preview widths and Show/Hide preview without losing unsaved edits', async () => {
    renderPanel();

    const headingInput = screen.getByLabelText(/^Heading/i) as HTMLInputElement;
    fireEvent.change(headingInput, { target: { value: 'Unsaved Draft Copy' } });

    fireEvent.click(screen.getByRole('button', { name: 'Show Preview' }));
    await screen.findByLabelText('Live site content preview');

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

  it('preserves Fieldset ID DOM node and focus while typing and handles schema-invalid form nodes without crashing', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /portal-contact/i }));
    const fieldsetIdInput = screen.getAllByLabelText('Fieldset ID')[0] as HTMLInputElement;
    fieldsetIdInput.focus();
    expect(document.activeElement).toBe(fieldsetIdInput);

    fireEvent.change(fieldsetIdInput, { target: { value: 'sender-identity-v2' } });
    expect(fieldsetIdInput.isConnected).toBe(true);
    expect(document.activeElement).toBe(fieldsetIdInput);
    expect(fieldsetIdInput.value).toBe('sender-identity-v2');

    // Switch to Raw JSON with fieldset omitting children and a null node entry, then back to Form
    fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));
    const jsonBox = screen.getByLabelText('Raw Metadata JSON') as HTMLTextAreaElement;
    const malformedContact = {
      windowTitle: 'Contact',
      statusBadge: { source: 'contact', state: 'ready', label: 'PG19' },
      description: 'Send a direct message.',
      form: {
        id: 'contact-form',
        slug: 'contact',
        title: 'Contact',
        description: 'Desc',
        cliCommand: 'contact',
        submitLabel: 'Send',
        resetLabel: 'Reset',
        nodes: [{ kind: 'fieldset', id: 'broken-fs', legend: 'Broken Fieldset' }, null],
      },
    };
    fireEvent.change(jsonBox, { target: { value: JSON.stringify(malformedContact, null, 2) } });
    fireEvent.click(screen.getByRole('button', { name: 'Form' }));

    expect(screen.getByText('Fieldset: Broken Fieldset')).toBeTruthy();
    expect(screen.getByText('Invalid node at index 1')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders dedicated portal-home portrait and resumeSummary sub-editors, blocks silent default resurrection on clear, and updates desktop/mobile live preview', async () => {
    const { container } = renderPanel();

    // Hydrated legacy 5-field portal-home opens with dedicated Portrait and Resume Summary fieldsets
    const portraitSrcInput = screen.getByLabelText('Portrait Source Path') as HTMLInputElement;
    const bioTextarea = screen.getByLabelText('Engineering Bio') as HTMLTextAreaElement;
    expect(portraitSrcInput.value).toBe('/images/andrew-klapper-portrait.webp');
    expect(bioTextarea.value).toContain('Senior Full-Stack & Systems Engineer');

    // Clearing a required nested field keeps empty string (no default resurrection) and disables Save
    fireEvent.change(portraitSrcInput, { target: { value: '' } });
    expect(portraitSrcInput.value).toBe('');
    expect(portraitSrcInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Save Site Content' })).toHaveProperty(
      'disabled',
      true,
    );

    // Restore valid portrait src and update bio + add a highlight
    fireEvent.change(portraitSrcInput, {
      target: { value: '/images/andrew-klapper-portrait.webp' },
    });
    const customBio =
      'Updated bio showcasing Go, TypeScript/React, and PostgreSQL 19 architecture.';
    fireEvent.change(bioTextarea, { target: { value: customBio } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add Highlight' }));

    // Round-trip Form -> Raw JSON -> Form preserves edits
    fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));
    const rawJson = screen.getByLabelText('Raw Metadata JSON') as HTMLTextAreaElement;
    expect(rawJson.value).toContain(customBio);
    fireEvent.click(screen.getByRole('button', { name: 'Form' }));
    expect((screen.getByLabelText('Engineering Bio') as HTMLTextAreaElement).value).toBe(customBio);

    // Live Preview shows portrait + updated bio + launcher across Desktop & Mobile with single <form>
    fireEvent.click(screen.getByRole('button', { name: 'Show Preview' }));
    const preview = await screen.findByLabelText('Live site content preview');
    expect(within(preview).getByText(customBio)).toBeTruthy();
    expect(preview.querySelector('[data-terminal-portrait="true"]')).not.toBeNull();
    expect(preview.querySelector('form')).toBeNull();
    expect(preview.querySelector('iframe')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(preview.querySelector('[data-preview-viewport="mobile"]')).not.toBeNull();
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save Site Content' })).toHaveProperty(
      'disabled',
      false,
    );
  });
});
