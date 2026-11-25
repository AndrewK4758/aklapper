import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('menu', 'routes/menu.tsx'),
  route('cadence', 'routes/cadence.tsx'),
  route('ask', 'routes/ask.tsx'),
  route('agensi', 'routes/agensi.tsx'),
  route('contact', 'routes/contact.tsx'),
  route('api/contact', 'routes/api.contact.ts'),
  route('api/ask/stream', 'routes/api.ask.stream.ts'),
  route('api/ask/turns/:attemptId', 'routes/api.ask.turns.$attemptId.ts'),
  route('api/analytics/ingest', 'routes/api.analytics.ingest.ts'),
  route('api/cluster/stream', 'routes/api.cluster.stream.ts'),
  route('api/cadence/runs/:runId/stream', 'routes/api.cadence.runs.$runId.stream.ts'),
  route('changes-in-progress', 'routes/changes-in-progress.tsx'),
  route('*', 'routes/changes-in-progress.tsx', { id: 'routes/changes-in-progress-catchall' }),
] satisfies RouteConfig;
