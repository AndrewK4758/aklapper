export const PORTAL_ROUTE_PATHS = [
  '/',
  '/menu',
  '/cadence',
  '/ask',
  '/agensi',
  '/contact',
  '/api/contact',
  '/api/analytics/ingest',
  '/api/cluster/stream',
  '/changes-in-progress',
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
  '/api/ops/cluster/stream',
] as const;

export type AdminRoutePath = (typeof ADMIN_ROUTE_PATHS)[number];
