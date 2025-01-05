import { RouteObject } from 'react-router-dom';
import Layout from '../components/layout/layout';
import { lazy } from 'react';

const QueryModel = lazy(() => import('../components/query-model/query-model'));

const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      {
        path: 'query-model',
        Component: QueryModel
      }
    ]
  }
];

export default routes;
