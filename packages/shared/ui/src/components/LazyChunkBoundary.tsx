import {
  Component,
  createContext,
  createElement,
  type ErrorInfo,
  type FunctionComponent,
  lazy,
  type LazyExoticComponent,
  type ReactNode,
  Suspense,
  useContext,
} from 'react';

import { Button } from '../elements/base';
import { LoadingElement } from './LoadingElement';

import styles from './ErrorElement.module.css';

const MAX_LAZY_RETRY_CACHE_ENTRIES = 16;

const LazyChunkRetryContext = createContext<number>(0);

type LazyComponentFn = (props: never) => ReactNode | Promise<ReactNode>;

type LazyComponentProps<TComponent extends LazyComponentFn> = TComponent extends (
  props: infer TProps,
) => ReactNode | Promise<ReactNode>
  ? unknown extends TProps
    ? Record<string, never>
    : TProps
  : Record<string, never>;

export function lazyWithRetry<TComponent extends LazyComponentFn>(
  factory: () => Promise<{ default: TComponent }>,
): FunctionComponent<LazyComponentProps<TComponent>> {
  const cache = new Map<
    number,
    LazyExoticComponent<FunctionComponent<LazyComponentProps<TComponent>>>
  >();

  function LazyRetryWrapper(props: LazyComponentProps<TComponent>): ReactNode {
    const retryKey = useContext(LazyChunkRetryContext);
    let LazyComponent = cache.get(retryKey);
    if (!LazyComponent) {
      if (cache.size >= MAX_LAZY_RETRY_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
      LazyComponent = lazy(
        factory as unknown as () => Promise<{
          default: FunctionComponent<LazyComponentProps<TComponent>>;
        }>,
      );
      cache.set(retryKey, LazyComponent);
    }
    return createElement(LazyComponent, props);
  }

  LazyRetryWrapper.displayName = 'LazyWithRetry';
  return LazyRetryWrapper;
}

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
      <LazyChunkRetryContext.Provider value={this.state.retryKey}>
        <Suspense key={this.state.retryKey} fallback={fallback}>
          {this.props.children}
        </Suspense>
      </LazyChunkRetryContext.Provider>
    );
  }
}
