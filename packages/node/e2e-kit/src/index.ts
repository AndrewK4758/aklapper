import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export interface StartNodeApiOptions {
  /** Absolute or cwd-relative path to the Node API TypeScript entrypoint (e.g. src/main.ts). */
  entryPath: string;
  /** Working directory for the spawned Node API process. */
  cwd: string;
  /** Health endpoint polled until HTTP 200 is returned (defaults to /healthz). */
  healthPath?: string;
  /** Additional environment variables merged into the spawned process environment. */
  env?: Readonly<Record<string, string>>;
  /** Startup readiness timeout in milliseconds (defaults to 15000). */
  startupTimeoutMs?: number;
}

export interface RunningNodeApi {
  readonly baseUrl: string;
  readonly port: number;
  close: () => Promise<void>;
}

export interface JsonResponse<T> {
  readonly status: number;
  readonly headers: Headers;
  readonly data: T;
}

export async function reserveLoopbackPort(): Promise<number> {
  return new Promise<number>((resolvePort, rejectPort) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rejectPort);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (!address || typeof address === 'string') {
        srv.close(() => rejectPort(new Error('Failed to resolve ephemeral loopback TCP port')));
        return;
      }
      const { port } = address;
      srv.close(closeErr => {
        if (closeErr) {
          rejectPort(closeErr);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>(resolveExit => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolveExit();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

export async function startNodeApiProcess(options: StartNodeApiOptions): Promise<RunningNodeApi> {
  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const healthPath = options.healthPath ?? '/healthz';
  const startupTimeoutMs = options.startupTimeoutMs ?? 15_000;
  const entry = resolve(options.cwd, options.entryPath);

  const logs: string[] = [];
  const child = spawn(process.execPath, ['--conditions=@aklapper/source', entry], {
    cwd: options.cwd,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
  child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));

  const close = async (): Promise<void> => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    await waitForExit(child, 5_000);
  };

  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Node API process (${entry}) exited before becoming healthy (code=${String(child.exitCode)}, signal=${String(child.signalCode)}).\nLogs:\n${logs.join('')}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}${healthPath}`);
      if (response.ok) {
        return { baseUrl, port, close };
      }
    } catch {
      // Server socket not listening yet; keep polling until deadline.
    }
    await delay(50);
  }

  await close();
  throw new Error(
    `Node API process (${entry}) did not become healthy at ${baseUrl}${healthPath} within ${startupTimeoutMs}ms.\nLogs:\n${logs.join('')}`,
  );
}

export async function fetchJson<T>(
  url: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Readonly<Record<string, string>>;
  } = {},
): Promise<JsonResponse<T>> {
  const headers: Record<string, string> = { ...init.headers };
  const hasBody = init.body !== undefined;
  if (hasBody && !Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });

  const text = await response.text();
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `Expected JSON from ${init.method ?? 'GET'} ${url} (HTTP ${response.status}): ${String(err)}\nBody: ${text}`,
    );
  }
  return {
    status: response.status,
    headers: response.headers,
    data: parsed,
  };
}
