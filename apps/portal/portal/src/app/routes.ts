import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('menu', 'routes/menu.tsx'),
  route('cadence', 'routes/cadence.tsx'),
  route('changes-in-progress', 'routes/changes-in-progress.tsx'),
  route('*', 'routes/changes-in-progress.tsx', { id: 'routes/changes-in-progress-catchall' }),
] satisfies RouteConfig;
