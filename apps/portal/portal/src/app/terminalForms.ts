import type { ContactActionResult, FormDefinition } from '@aklapper/contracts';
import type { TerminalFormConfig } from '@aklapper/ui';

export async function submitPortalContactForm(formData: FormData): Promise<ContactActionResult> {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });

  try {
    return (await response.json()) as ContactActionResult;
  } catch {
    return {
      ok: false,
      source: 'server',
      formError: `Unexpected response from /api/contact (HTTP ${response.status}).`,
      fieldErrors: {},
    };
  }
}

export function createPortalTerminalForms(
  contactForm: FormDefinition | undefined,
  navigate: (to: string) => void | Promise<void>,
): Readonly<Record<string, TerminalFormConfig>> | undefined {
  if (!contactForm) {
    return undefined;
  }
  return {
    [contactForm.cliCommand.toLowerCase()]: {
      definition: contactForm,
      openTuiRoute: () => {
        void navigate('/contact');
      },
      submit: submitPortalContactForm,
    },
  };
}
