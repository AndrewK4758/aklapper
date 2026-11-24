import { CSPProvider as BaseCSPProvider } from '@base-ui/react/csp-provider';

export const CSPProvider = Object.assign(BaseCSPProvider, {
  Provider: BaseCSPProvider,
  Root: BaseCSPProvider,
});

export type { CSPProviderProps } from '@base-ui/react/csp-provider';
