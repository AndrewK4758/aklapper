import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  route('analytics', 'routes/analytics.tsx'),
  route('cms', 'routes/cms.tsx'),
  route('inbox', 'routes/inbox.tsx'),
  route('inbox/:id/attachment', 'routes/inbox.$id.attachment.ts'),
  route('quotas', 'routes/quotas.tsx'),
  route('ops', 'routes/ops.tsx'),
  route('api/auth/*', 'routes/api.auth.$.ts'),
  route('api/analytics/ingest', 'routes/api.analytics.ingest.ts'),
  route('api/ops/cluster/stream', 'routes/api.ops.cluster.stream.ts'),
] satisfies RouteConfig;
