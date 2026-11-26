export const PORTAL_NAVIGABLE_ROUTE_PATHS = [
  '/',
  '/about',
  '/cadence',
  '/chat',
  '/agensi',
  '/contact',
] as const;

export type PortalNavigableRoutePath = (typeof PORTAL_NAVIGABLE_ROUTE_PATHS)[number];

const PORTAL_NAVIGABLE_ROUTE_SET = new Set<string>(PORTAL_NAVIGABLE_ROUTE_PATHS);

export function isPortalNavigableRoutePath(value: string): value is PortalNavigableRoutePath {
  return PORTAL_NAVIGABLE_ROUTE_SET.has(value);
}

export const PORTAL_ROUTE_PATHS = [
  '/',
  '/about',
  '/cadence',
  '/chat',
  '/agensi',
  '/contact',
  '/api/contact',
  '/api/ask/stream',
  '/api/ask/turns/:attemptId',
  '/api/analytics/ingest',
  '/api/runtime/status',
  '/api/cadence/runs/:runId/stream',
] as const;

export type PortalRoutePath = (typeof PORTAL_ROUTE_PATHS)[number];

export const ADMIN_ROUTE_PATHS = [
  '/',
  '/login',
  '/analytics',
  '/cms',
  '/inbox',
  '/inbox/:id/attachment',
  '/quotas',
  '/ops',
  '/api/analytics/ingest',
  '/api/ops/runtime/status',
] as const;

export type AdminRoutePath = (typeof ADMIN_ROUTE_PATHS)[number];
