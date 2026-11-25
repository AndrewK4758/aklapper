import { fireEvent, render, screen } from '@testing-library/react';
import { type ComponentType, lazy, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LazyChunkBoundary } from '../src';
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
    const deferred = Promise.withResolvers<{ default: ComponentType }>();
    const LazyWidget = lazy(() => deferred.promise);

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

  it('catches chunk load failures, notifies onChunkError, and retries cleanly', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onChunkError = vi.fn<(error: unknown) => void>();
    let shouldThrow = true;

    function FlakyModule(): ReactElement {
      if (shouldThrow) {
        throw new Error('Failed to fetch dynamically imported module');
      }
      return <p>Recovered module</p>;
    }

    render(
      <LazyChunkBoundary
        loadingLabel='Loading panel...'
        errorTitle='Panel failed to load'
        onChunkError={onChunkError}
      >
        <FlakyModule />
      </LazyChunkBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Panel failed to load');
    expect(alert.getAttribute('data-chunk-error')).toBe('true');
    expect(onChunkError).toHaveBeenCalledTimes(1);

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Recovered module')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    consoleErrorSpy.mockRestore();
  });
});
