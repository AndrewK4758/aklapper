import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react';

import { Button } from '../elements/base';
import { LoadingElement } from './LoadingElement';

import styles from './ErrorElement.module.css';

export interface LazyChunkBoundaryProps {
  readonly loadingLabel: string;
  readonly fallback?: ReactNode;
  readonly errorTitle?: string;
  readonly onChunkError?: (error: unknown) => void;
  readonly children: ReactNode;
}

interface LazyChunkBoundaryState {
  readonly hasError: boolean;
  readonly retryKey: number;
}

export class LazyChunkBoundary extends Component<LazyChunkBoundaryProps, LazyChunkBoundaryState> {
  override state: LazyChunkBoundaryState = {
    hasError: false,
    retryKey: 0,
  };

  static getDerivedStateFromError(): Partial<LazyChunkBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    this.props.onChunkError?.(error);
  }

  private readonly handleRetry = (): void => {
    this.setState(previous => ({
      hasError: false,
      retryKey: previous.retryKey + 1,
    }));
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section role='alert' className={styles.card} data-chunk-error='true'>
          <div className={styles.header}>
            <code className={styles.codeBadge}>CHUNK_LOAD_ERROR</code>
          </div>
          <div className={styles.body}>
            <p className={styles.message}>{this.props.errorTitle ?? 'Unable to load module'}</p>
            <p className={styles.action}>
              A required interface module could not be fetched. Retry to load the latest bundle.
            </p>
          </div>
          <div className={styles.controls}>
            <Button type='button' variant='primary' size='sm' onClick={this.handleRetry}>
              <Button.Label>Retry</Button.Label>
            </Button>
          </div>
        </section>
      );
    }

    const fallback = this.props.fallback ?? <LoadingElement label={this.props.loadingLabel} />;

    return (
      <Suspense key={this.state.retryKey} fallback={fallback}>
        {this.props.children}
      </Suspense>
    );
  }
}
