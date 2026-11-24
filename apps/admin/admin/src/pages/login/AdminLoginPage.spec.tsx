import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminLoginPage } from './AdminLoginPage';
import { base64UrlToBuffer, bufferToBase64Url } from './webauthnClient';

describe('AdminLoginPage', () => {
  it('round-trips base64url WebAuthn buffers cleanly', () => {
    const raw = new Uint8Array([0, 1, 2, 250, 251, 255]).buffer;
    const encoded = bufferToBase64Url(raw);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = new Uint8Array(base64UrlToBuffer(encoded));
    expect(Array.from(decoded)).toEqual([0, 1, 2, 250, 251, 255]);
  });

  it('renders Passkey Sign In and switches to Bootstrap Passkey tab', () => {
    render(<AdminLoginPage nextTarget='/analytics' />);

    expect(screen.getByRole('heading', { name: 'Admin Passkey Gate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Passkey' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Bootstrap Passkey' }));
    expect(screen.getByLabelText('Bootstrap Token')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Register Bootstrap Passkey' })).toBeTruthy();
  });

  it('transitions to TOTP 2FA step when passkey verification returns requiresTotp', async () => {
    const onAuthenticated = vi.fn<(target: string) => void>();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            challengeId: 'chal-1',
            options: { challenge: 'AQIDBA', rpId: 'localhost' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verified: false,
            requiresTotp: true,
            pendingToken: 'v1.pending.sig',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const originalCredentials = navigator.credentials;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        get: vi.fn<() => Promise<unknown>>().mockResolvedValue({
          id: 'cred-1',
          rawId: new Uint8Array([1, 2, 3]).buffer,
          type: 'public-key',
          authenticatorAttachment: 'platform',
          getClientExtensionResults: () => ({}),
          response: {
            clientDataJSON: new Uint8Array([4, 5]).buffer,
            authenticatorData: new Uint8Array([6, 7]).buffer,
            signature: new Uint8Array([8, 9]).buffer,
            userHandle: null,
          },
        }),
      },
    });

    try {
      render(<AdminLoginPage nextTarget='/analytics' onAuthenticated={onAuthenticated} />);
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Passkey' }));

      const totpInput = await screen.findByLabelText(/2FA Verification Code/i);
      fireEvent.change(totpInput, { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify 2FA Code' }));

      await waitFor(() => {
        expect(onAuthenticated).toHaveBeenCalledWith('/analytics');
      });
    } finally {
      fetchSpy.mockRestore();
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: originalCredentials,
      });
    }
  });
});
