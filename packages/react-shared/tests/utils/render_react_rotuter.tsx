/* eslint-disable react-refresh/only-export-components */
import { render, RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

export type RouteString = `/${string}`;
export type RoutesObject = (typeof ROUTES)[keyof typeof ROUTES];

export interface RenderInRouterOptions extends Omit<RenderOptions, 'wrapper' | 'path'> {
  initialRoute: RoutesObject;
  path: RoutesObject;
}

export const ROUTES = Object.freeze({
  LANDING: '/',
  PORTFOLIO: '/portfolio',
  CRUD: 'crud',
  GAMES: 'games',
  GEN_AI: 'gen-ai',
});

function renderInRouter(
  ui: ReactElement,
  options: RenderInRouterOptions,
): RenderResult<
  typeof import('/home/ak/projects/aklapper/node_modules/.pnpm/@testing-library+dom@10.4.0/node_modules/@testing-library/dom/types/queries'),
  HTMLElement,
  HTMLElement
> {
  const { initialRoute, path, ...renderOptions } = options;

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>,
    { ...renderOptions },
  );
}

export * from '@testing-library/react';

export { renderInRouter as render };
