import { resolve } from 'node:path';

import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import {
  type APIRequestContext,
  defineConfig,
  devices,
  expect,
  type Page,
  type PlaywrightTestConfig,
} from '@playwright/test';

export interface SsrPlaywrightConfigOptions {
  /** Absolute directory containing `playwright.config.ts` (pass `import.meta.dirname`). */
  configDir: string;
  /** Relative path from `configDir` to the SSR application directory (e.g. `../portal`). */
  appDir: string;
  /** Default local SSR port when neither `baseUrlEnvVar` nor `portEnvVar` is set. */
  defaultPort: number;
  /** Environment variable holding a pre-deployed base URL (skips `webServer` when set). */
  baseUrlEnvVar: string;
  /** Environment variable overriding the local SSR server port. */
  portEnvVar: string;
  /** Optional extra environment variables passed to the managed SSR `webServer`. */
  extraEnv?: Record<string, string>;
}

function resolveReporters(isCI: boolean): PlaywrightTestConfig['reporter'] {
  if (process.env['PLAYWRIGHT_BLOB_REPORT'] === '1') {
    return [['blob']];
  }
  if (isCI) {
    return [
      ['github'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
    ];
  }
  return [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]];
}

function buildWebServerEnv(
  port: number,
  portEnvVar: string,
  extraEnv: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return {
    ...env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    [portEnvVar]: String(port),
    ...extraEnv,
  };
}

export function createSsrPlaywrightConfig(
  options: SsrPlaywrightConfigOptions,
): PlaywrightTestConfig {
  const { configDir, appDir, defaultPort, baseUrlEnvVar, portEnvVar, extraEnv = {} } = options;

  loadWorkspaceEnv({ startDir: configDir, mode: 'e2e' });

  const isCI = Boolean(process.env['CI']);
  const externalBaseURL = process.env[baseUrlEnvVar]?.trim();
  const parsedPort = Number(process.env[portEnvVar] ?? defaultPort);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : defaultPort;
  const baseURL =
    externalBaseURL && externalBaseURL.length > 0 ? externalBaseURL : `http://127.0.0.1:${port}`;
  const appCwd = resolve(configDir, appDir);

  return defineConfig({
    testDir: './src',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 2 : undefined,
    timeout: 30_000,
    expect: {
      timeout: 10_000,
    },
    reporter: resolveReporters(isCI),
    use: {
      baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: isCI ? 'retain-on-failure' : 'off',
      actionTimeout: 10_000,
      navigationTimeout: 15_000,
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
      {
        name: 'mobile-chrome',
        use: { ...devices['Pixel 7'], channel: 'chrome' },
      },
    ],
    webServer: externalBaseURL
      ? undefined
      : {
          command:
            'sh -c "[ -f dist/server/index.js ] || pnpm exec react-router build --mode production; exec node --conditions=@aklapper/source ./src/server.ts"',
          cwd: appCwd,
          url: `http://127.0.0.1:${port}/healthz`,
          reuseExistingServer: !isCI && process.env['AKLAPPER_EPHEMERAL_PG_ACTIVE'] !== '1',
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
          env: buildWebServerEnv(port, portEnvVar, extraEnv),
        },
  });
}

export async function assertSsrHealthz(
  request: APIRequestContext,
  expectedService: string,
): Promise<void> {
  const response = await request.get('/healthz');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { status?: string; service?: string };
  expect(body).toEqual({ status: 'ok', service: expectedService });
}

export async function waitForStreamedReveal(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll('div[hidden][id^="S:"]').length === 0);
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

export async function gotoStreamedPage(
  page: Page,
  url: string,
  options: { readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {},
): Promise<void> {
  await page.goto(url, { waitUntil: options.waitUntil ?? 'load' });
  await waitForStreamedReveal(page);
}

export async function reloadStreamedPage(
  page: Page,
  options: { readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {},
): Promise<void> {
  await page.reload({ waitUntil: options.waitUntil ?? 'load' });
  await waitForStreamedReveal(page);
}

export function trackPageErrors(page: Page): () => readonly Error[] {
  const errors: Error[] = [];
  page.on('pageerror', error => {
    errors.push(error);
  });
  return () => errors;
}
