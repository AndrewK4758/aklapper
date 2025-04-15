import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import Layout from '../components/layout/layout';
import loadAvailableModels from '../services/loaders/load-available-models';

const QueryModel = lazy(() => import('../components/query-model/query-model'));

const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      {
        path: 'query-model',
        Component: QueryModel,
        loader: loadAvailableModels,
        hydrateFallbackElement: <h1>Fallback Element</h1>,
      },
    ],
  },
];

export default routes;
