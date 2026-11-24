# Repository Engineering Rules (`aklapper`)

Standing rules for all contributors and AI agents working in this repository.

## React & Frontend Rules

- **Avoid `useEffect` unless absolutely necessary.** Do not use `useEffect` for derived state, data transformations, resetting state on prop changes, or handling user-triggered events.
  - Prefer computing derived values directly during render, handling actions inside event handlers, loading/mutating data through React Router `loader`/`action` functions, keying components to reset state, or using `useSyncExternalStore` for external store subscriptions.
  - Only use `useEffect` when synchronizing with an external system that cannot be expressed declaratively during render or via event handlers (for example: browser DOM/tab APIs, intervals/timers, WebSockets, or third-party imperative widgets), and always include proper cleanup.
- **Strict 4-layer CSS architecture:** Keep all styles strictly layered as `@layer tokens, element, component, page;` with all design tokens defined as CSS custom properties at `:root` and consumed via CSS Modules (`*.module.css`).

## TypeScript, Tooling & Verification Rules

- **TypeScript everywhere, strict ESM:** No `.js` files in source code; all source files must be `.ts`/`.tsx` with zero `any` types (`typescript/no-explicit-any` enforced in `.oxlintrc.json`) and `"type": "module"` in every `package.json`.
- **Testing:** Use Vitest for unit/integration tests and Playwright for frontend E2E tests (no Jest).
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
