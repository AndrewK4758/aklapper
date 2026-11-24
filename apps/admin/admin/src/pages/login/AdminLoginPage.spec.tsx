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

  it('renders unified password and passkey login form without Bootstrap Passkey tab or bootstrap token input', () => {
    render(<AdminLoginPage nextTarget='/analytics' />);

    expect(screen.getByRole('heading', { name: 'Admin Passkey Gate' })).toBeTruthy();

    const handleInput = screen.getByLabelText('Admin Handle') as HTMLInputElement;
    expect(handleInput.getAttribute('autocomplete')).toBe('username webauthn');

    expect(screen.getByLabelText('Password')).toBeTruthy();

    const pwButton = screen.getByRole('button', {
      name: 'Sign in with Password',
    }) as HTMLButtonElement;
    const passkeyButton = screen.getByRole('button', {
      name: 'Sign in with Passkey',
    }) as HTMLButtonElement;
    expect(pwButton.type).toBe('submit');
    expect(passkeyButton.type).toBe('button');

    expect(screen.queryByRole('tab', { name: /Bootstrap/i })).toBeNull();
    expect(screen.queryByLabelText(/Bootstrap Token/i)).toBeNull();
  });

  it('opens post-login Create Passkey step when passkeyCount === 0, handles NotAllowedError cancellation, and registers on retry', async () => {
    const onAuthenticated = vi.fn<(target: string) => void>();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verified: true,
            requiresTotp: false,
            passkeyCount: 0,
            session: {
              sessionId: 's1',
              role: 'admin',
              handle: 'admin',
              expiresAt: '2026-12-01T00:00:00Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            challengeId: 'reg-chal-1',
            options: {
              challenge: 'AQIDBA',
              rp: { id: 'localhost', name: 'andrew-k.us Admin' },
              user: { id: 'AQID', name: 'admin', displayName: 'admin' },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
              authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            challengeId: 'reg-chal-2',
            options: {
              challenge: 'AQIDBA',
              rp: { id: 'localhost', name: 'andrew-k.us Admin' },
              user: { id: 'AQID', name: 'admin', displayName: 'admin' },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
              authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true, credentialId: 'new-cred-1' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const createMock = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new DOMException('The operation was cancelled', 'NotAllowedError'))
      .mockResolvedValueOnce({
        id: 'new-cred-1',
        rawId: new Uint8Array([1, 2, 3]).buffer,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        getClientExtensionResults: () => ({}),
        response: {
          clientDataJSON: new Uint8Array([4, 5]).buffer,
          attestationObject: new Uint8Array([6, 7]).buffer,
          getTransports: () => ['internal'],
        },
      });

    const originalCredentials = navigator.credentials;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { create: createMock },
    });

    try {
      render(<AdminLoginPage nextTarget='/analytics' onAuthenticated={onAuthenticated} />);
      fireEvent.change(screen.getByLabelText('Admin Handle'), { target: { value: 'admin' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pw' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Password' }));

      const createBtn = await screen.findByRole('button', { name: 'Create Passkey' });
      expect(screen.getByRole('button', { name: 'Continue to Console' })).toBeTruthy();
      expect(onAuthenticated).not.toHaveBeenCalled();

      // First attempt cancelled -> shows alert, preserves prompt & skip option
      fireEvent.click(createBtn);
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Continue to Console' })).toBeTruthy();

      // Retry succeeds and completes navigation
      fireEvent.click(screen.getByRole('button', { name: 'Create Passkey' }));
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

  it('allows skipping Create Passkey via Continue to Console and skips prompt when passkeyCount > 0', async () => {
    const onAuthenticated = vi.fn<(target: string) => void>();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true, requiresTotp: false, passkeyCount: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true, requiresTotp: false, passkeyCount: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    try {
      const { unmount } = render(
        <AdminLoginPage nextTarget='/ops' onAuthenticated={onAuthenticated} />,
      );
      fireEvent.change(screen.getByLabelText('Admin Handle'), { target: { value: 'admin' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pw' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Password' }));

      const skipBtn = await screen.findByRole('button', { name: 'Continue to Console' });
      fireEvent.click(skipBtn);
      expect(onAuthenticated).toHaveBeenCalledWith('/ops');
      unmount();

      onAuthenticated.mockClear();
      render(<AdminLoginPage nextTarget='/cms' onAuthenticated={onAuthenticated} />);
      fireEvent.change(screen.getByLabelText('Admin Handle'), { target: { value: 'admin' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pw' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Password' }));
      await waitFor(() => {
        expect(onAuthenticated).toHaveBeenCalledWith('/cms');
      });
      expect(screen.queryByRole('button', { name: 'Create Passkey' })).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('transitions from password login through TOTP step-up into Create Passkey when passkeyCount === 0', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verified: false,
            requiresTotp: true,
            pendingToken: 'v1.pw-totp.sig',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verified: true,
            passkeyCount: 0,
            session: {
              sessionId: 's2',
              role: 'admin',
              handle: 'admin',
              expiresAt: '2026-12-01T00:00:00Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    try {
      render(<AdminLoginPage nextTarget='/analytics' />);

      // Blank submission surfaces accessible alert
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Password' }));
      expect((await screen.findByRole('alert')).textContent).toMatch(/required/i);

      fireEvent.change(screen.getByLabelText('Admin Handle'), { target: { value: 'admin' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pw' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Password' }));

      const totpInput = await screen.findByLabelText(/2FA Verification Code/i);
      fireEvent.change(totpInput, { target: { value: '654321' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify 2FA Code' }));

      expect(await screen.findByRole('button', { name: 'Create Passkey' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Continue to Console' })).toBeTruthy();
    } finally {
      fetchSpy.mockRestore();
    }
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
