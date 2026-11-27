import type { ContactActionResult, FormDefinition } from '@aklapper/core';
import { getActiveAnalyticsSessionId } from '@aklapper/core/analytics';
import type { TerminalFormConfig, TerminalNavTarget } from '@aklapper/ui';
import { href } from 'react-router';

export async function submitPortalContactForm(formData: FormData): Promise<ContactActionResult> {
  const endpoint = href('/api/contact');
  const payload = new FormData();
  for (const [key, value] of formData.entries()) {
    payload.append(key, value);
  }
  const existingSessionId = payload.get('analyticsSessionId');
  if (!existingSessionId || (typeof existingSessionId === 'string' && !existingSessionId.trim())) {
    const activeSessionId = getActiveAnalyticsSessionId();
    if (activeSessionId) {
      payload.set('analyticsSessionId', activeSessionId);
    }
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: payload,
    });
  } catch {
    return {
      ok: false,
      source: 'client',
      formError: `Unable to reach ${endpoint}. Check your network connection and retry.`,
      action: 'Verify network connectivity and resubmit your draft.',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      fieldErrors: {},
    };
  }

  try {
    return (await response.json()) as ContactActionResult;
  } catch {
    const correlationId = response.headers.get('x-correlation-id')?.trim() || undefined;
    return {
      ok: false,
      source: 'server',
      formError: `Unexpected response from ${endpoint} (HTTP ${response.status}).`,
      action: 'Retry or share the reference ID.',
      code: 'ERR_INTERNAL',
      ...(correlationId ? { correlationId } : {}),
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
      openTuiRoute: (_target?: TerminalNavTarget) => {
        void navigate(href('/contact'));
      },
      submit: submitPortalContactForm,
    },
  };
}
