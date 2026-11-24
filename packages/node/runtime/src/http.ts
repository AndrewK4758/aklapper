export interface UpstreamRequestOptions {
  baseUrl: string;
  path: string;
  method?: string;
  headers?: Readonly<Record<string, string>>;
  body?: BodyInit;
  timeoutMs?: number;
}

export function joinUpstreamUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
