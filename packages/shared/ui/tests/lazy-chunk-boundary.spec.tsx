import { fireEvent, render, screen } from '@testing-library/react';
import { type FunctionComponent, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LazyChunkBoundary, lazyWithRetry } from '../src';
import { QrCodeSvg } from '../src/qr-code';
import { SandboxedArtifactFrame } from '../src/sandboxed-artifact-frame';
import { SiteContentPreviewCanvas } from '../src/site-content-preview';
import { TerminalWorkspace } from '../src/terminal-workspace';

describe('LazyChunkBoundary and subpath exports', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the additive subpath entry points', () => {
    expect(TerminalWorkspace).toBeTypeOf('function');
    expect(QrCodeSvg).toBeTypeOf('function');
    expect(SandboxedArtifactFrame).toBeTypeOf('function');
    expect(SiteContentPreviewCanvas).toBeTypeOf('function');
  });

  it('renders LoadingElement while a lazy module is pending and resolves cleanly', async () => {
    const deferred = Promise.withResolvers<{ default: FunctionComponent }>();
    const LazyWidget = lazyWithRetry(() => deferred.promise);

    render(
      <LazyChunkBoundary loadingLabel='Loading widget module...'>
        <LazyWidget />
      </LazyChunkBoundary>,
    );

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Loading widget module...');

    deferred.resolve({
      default: (): ReactElement => <p>Loaded lazy widget</p>,
    });

    expect(await screen.findByText('Loaded lazy widget')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('catches rejected lazy chunk imports, notifies onChunkError, and retries cleanly via lazyWithRetry', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onChunkError = vi.fn<(error: unknown) => void>();
    let factoryCalls = 0;

    const LazyFlakyModule = lazyWithRetry(async (): Promise<{ default: FunctionComponent }> => {
      factoryCalls += 1;
      if (factoryCalls === 1) {
        throw new TypeError('Failed to fetch dynamically imported module');
      }
      return {
        default: (): ReactElement => <p>Recovered module</p>,
      };
    });

    render(
      <LazyChunkBoundary
        loadingLabel='Loading panel...'
        errorTitle='Panel failed to load'
        onChunkError={onChunkError}
      >
        <LazyFlakyModule />
      </LazyChunkBoundary>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Panel failed to load');
    expect(alert.getAttribute('data-chunk-error')).toBe('true');
    expect(factoryCalls).toBe(1);
    expect(onChunkError).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Recovered module')).toBeTruthy();
    expect(factoryCalls).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
    consoleErrorSpy.mockRestore();
  });
});
