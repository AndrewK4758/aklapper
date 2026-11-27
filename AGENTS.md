# Repository Engineering Rules (`aklapper`)

Standing rules for all contributors and AI agents working in this repository.

## Streaming SSR, Routing & React Rules

- **Zero-await streamed server data via `<Suspense>` and `<SuspenseElement<T>>`:**
  - Never `await` streamed database or upstream read queries in SSR route loaders (or streaming post-action payloads). Return synchronous route metadata alongside deferred `Promise<StreamResult<T>>` envelopes created via `deferStreamResult` from `@aklapper/node-runtime/ssr/stream`, and render them through `@aklapper/ui`'s generic `<SuspenseElement<T>>` (which wraps React `<Suspense>`, React Router `<Await>`, `<LoadingElement>`, and `<ErrorElement>`).
  - **Synchronous HTTP status and auth gates:** Keep authentication/redirect verification (`resolveAdminSessionFromRequest` / `requireAdminSession` on `admin` for immediate HTTP `302` / `401` enforcement), synchronous write/validation/rate-limit action gates (`200`/`201`/`400`/`404`/`422`/`429`/`503`), synchronous `<head>` SEO metadata, and first-visit `Set-Cookie` headers resolved before response headers flush.
  - **Never buffer SSR streams in memory:** Fastify SSR transport (`packages/node/runtime/src/site-server.ts`) must pipe non-null `ReadableStream` bodies directly via `Readable.fromWeb(...)` with `X-Accel-Buffering: no`, `X-Correlation-Id`, and premature client-disconnect abort propagation (`reply.raw.on('close')`).
- **Strongly typed React Router `+types/*` and `href()` routes (`portal` & `admin`):**
  - Type every route module (root, UI child, and API/resource routes) using generated `./+types/<route>` (`Route.LoaderArgs`, `Route.ActionArgs`, `Route.MetaArgs`, `Route.ComponentProps`, `Route.ErrorBoundaryProps`).
  - Eliminate all `useLoaderData() as ...`, `useActionData() as ...`, and `useRouteLoaderData(...) as ...` casts; use typed `loaderData`/`actionData` route props, `useRouteLoaderData<typeof loader>('root')`, and `href(...)` for internal navigation links.
  - Maintain bidirectional compile-time parity between `@aklapper/core` route path unions (`PortalRoutePath`, `AdminRoutePath`) and each app's `href()` parameter union.
  - Export a route `ErrorBoundary` rendering `<RouteErrorBoundaryView>` on every non-resource route module.
- **Avoid `useEffect` unless absolutely necessary.** Do not use `useEffect` for data fetching, promise unwrapping, error logging/telemetry, derived state, data transformations, resetting state on prop changes, or handling user-triggered events.
  - Prefer computing derived values directly during render, handling actions inside event handlers, loading/mutating data through React Router `loader`/`action` functions + `<SuspenseElement<T>>`, keying components to reset state, or using `useSyncExternalStore` for external store subscriptions.
  - Only use `useEffect` when synchronizing with an external system that cannot be expressed declaratively during render or via event handlers (for example: browser DOM/tab APIs, intervals/timers, WebSockets, or third-party imperative widgets), and always include proper cleanup.
- **Strict 4-layer CSS architecture:** Keep all styles strictly layered as `@layer tokens, element, component, page;` with all design tokens defined as CSS custom properties at `:root` and consumed via CSS Modules (`*.module.css`).

## Enterprise Error Handling & Observability Rules

- **Fail-closed error classification and redaction:**
  - Classify all server-side failures (SSR loaders, actions, resource routes, and entry-server `handleError`) through `classifyServerError` (`@aklapper/core/server-errors`) into a wire-safe `PublicAppError` (`code`, `status`, `message`, `action`, `correlationId`, optional `fieldErrors`) paired with a server-only PII-sanitized `DiagnosticAppError`.
  - Never expose raw exception messages, stack traces, SQL statements, bound query parameters, or connection strings to clients; every public error message and actionable recovery hint must come from the allow-listed catalog validated by `PublicAppErrorSchema`.
  - Log every classified server failure as structured JSON via `logDiagnosticError` (backed by Fastify Pino child loggers carrying the exact request `correlationId` echoed in `X-Correlation-Id`).
  - Surface optional `ActionErrorMetadata` (`code`, `action`, `correlationId`) inside `role="alert"` banners on failed mutations while preserving honest HTTP status codes via React Router `data(..., { status })` or `Response.json(..., { status })`.
- **Deduplicated client error telemetry:** Wire browser `entry.client.tsx` (`HydratedRouter` `onError` and React 19 `hydrateRoot` `onUncaughtError` / `onCaughtError` / `onRecoverableError`), `<SuspenseElement>`, and `<RouteErrorBoundaryView>` through `createClientErrorReporter` (`@aklapper/core/analytics`) targeting same-origin `/api/analytics/ingest` with `WeakSet` + cooldown deduplication and burst capping — never via `useEffect`.

## Package Modularity, TypeScript, Tooling & Verification Rules

- **Clean semantic modules & re-export-only `src/index.ts` barrels:**
  - Separate implementations, components, helpers, constants, and domain schemas into cohesive, single-responsibility semantic modules across every workspace package (`packages/shared/*`, `packages/node/*`, `packages/tooling`).
  - Every package `src/index.ts` barrel must contain strictly `export ... from '...'` re-export statements — never define functions, classes, constants, components, or Zod schemas inline inside `index.ts`.
  - Keep browser-consumed packages (such as `@aklapper/core`) free of `node:*` imports and keep route-imported SSR stream helpers on Fastify-free subpaths (`@aklapper/node-runtime/ssr/stream`).
- **TypeScript everywhere, strict ESM:** No `.js` files in source code; all source files must be `.ts`/`.tsx` with zero `any` types (`typescript/no-explicit-any` enforced in `.oxlintrc.json`) and `"type": "module"` in every `package.json`.
- **Testing:** Use Vitest (with `createRoutesStub` for route tests) for unit/integration tests and Playwright for frontend E2E tests (no Jest).
- **Duplicate-code gate before finishing:** Run WebStorm's inspection/duplicate check (`jetbrains:lint_files`) on touched files before finishing; extract any duplicated logic into a shared workspace package.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
