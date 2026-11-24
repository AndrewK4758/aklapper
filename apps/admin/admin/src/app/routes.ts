import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  route('analytics', 'routes/analytics.tsx'),
  route('api/auth/*', 'routes/api.auth.$.ts'),
  route('api/analytics/ingest', 'routes/api.analytics.ingest.ts'),
] satisfies RouteConfig;
