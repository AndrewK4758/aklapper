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
