import http2 from 'node:http2';
import type { AddressInfo } from 'node:net';

import type { TerminalProfileData } from '@aklapper/core';
import {
  getPrerenderPortalAskData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalContactData,
  getPrerenderPortalHomeData,
  getPrerenderPortalRootData,
} from '@aklapper/core/prerender';
import { create } from '@bufbuild/protobuf';
import { connectNodeAdapter } from '@connectrpc/connect-node';

import { CadenceService, ListRunsResponseSchema } from './gen/cadence/v1/cadence_pb.ts';
import { QuotaStatusSchema } from './gen/common/v1/error_pb.ts';
import { AnalyticsService, RecordSsrHitResponseSchema } from './gen/portal/v1/analytics_pb.ts';
import {
  GetAskContentResponseSchema,
  GetCadenceContentResponseSchema,
  GetContactContentResponseSchema,
  GetHomeContentResponseSchema,
  GetRootContentResponseSchema,
  PortalContentService,
  TerminalCommandSpecSchema,
  TerminalInitialEntrySchema,
  TerminalProfileDataSchema,
} from './gen/portal/v1/content_pb.ts';

export type PortalStubProcedure =
  | 'getRootContent'
  | 'getHomeContent'
  | 'getAskContent'
  | 'getCadenceContent'
  | 'getContactContent'
  | 'recordSsrHit'
  | 'listCadenceRuns';

export interface StartPortalApiStubServerOptions {
  readonly beforeProcedure?: (procedure: PortalStubProcedure) => void;
}

export interface PortalApiStubServer {
  readonly baseUrl: string;
  readonly getRequestCount: () => number;
  readonly resetRequestCount: () => void;
  readonly close: () => Promise<void>;
}

function toProtoTerminal(terminal: TerminalProfileData | undefined) {
  if (!terminal) {
    return undefined;
  }
  return create(TerminalProfileDataSchema, {
    slug: terminal.slug,
    bannerTitle: terminal.bannerTitle,
    bannerMeta: terminal.bannerMeta,
    osLabel: terminal.osLabel,
    directory: terminal.directory,
    vcsBranch: terminal.vcsBranch,
    vcsState: terminal.vcsState,
    contextLabel: terminal.contextLabel,
    placeholder: terminal.placeholder,
    quickCommands: [...terminal.quickCommands],
    initialEntries: terminal.initialEntries.map(e =>
      create(TerminalInitialEntrySchema, {
        command: e.command,
        output: e.output,
        status: e.status,
        durationLabel: e.durationLabel,
        timestamp: e.timestamp,
        sortOrder: e.sortOrder,
      }),
    ),
    commands: terminal.commands.map(c =>
      create(TerminalCommandSpecSchema, {
        name: c.name,
        description: c.description,
        kind: c.kind,
        output: c.output,
        ...(c.targetRoute !== null ? { targetRoute: c.targetRoute } : {}),
        allowedRoutes: [...c.allowedRoutes],
        ...(c.errorTemplate !== null ? { errorTemplate: c.errorTemplate } : {}),
        sortOrder: c.sortOrder,
      }),
    ),
  });
}

/**
 * Starts an in-process HTTP/2 h2c ConnectRPC server serving prerender PortalContentService and
 * no-op AnalyticsService responses for DB-free Fastify SSR integration tests.
 */
export async function startPortalApiStubServerForTest(
  options: StartPortalApiStubServerOptions = {},
): Promise<PortalApiStubServer> {
  let requestCount = 0;
  const rootData = getPrerenderPortalRootData();
  const homeData = getPrerenderPortalHomeData();
  const askData = getPrerenderPortalAskData();
  const cadenceData = getPrerenderPortalCadenceData();
  const contactData = getPrerenderPortalContactData();

  const handler = connectNodeAdapter({
    routes: router => {
      router.service(PortalContentService, {
        getRootContent() {
          requestCount += 1;
          options.beforeProcedure?.('getRootContent');
          return create(GetRootContentResponseSchema, {
            chromeJson: JSON.stringify(rootData.chrome),
            homeContentJson: JSON.stringify(rootData.homeContent),
            terminal: toProtoTerminal(rootData.terminal),
            contactFormJson: JSON.stringify(rootData.contactForm),
          });
        },
        getHomeContent() {
          requestCount += 1;
          options.beforeProcedure?.('getHomeContent');
          return create(GetHomeContentResponseSchema, {
            contentJson: JSON.stringify(homeData.content),
            terminal: toProtoTerminal(homeData.terminal),
            contactFormJson: JSON.stringify(homeData.contactForm),
          });
        },
        getAskContent() {
          requestCount += 1;
          options.beforeProcedure?.('getAskContent');
          return create(GetAskContentResponseSchema, {
            contentJson: JSON.stringify(askData.content),
            quota: create(QuotaStatusSchema, {
              role: askData.quota.role,
              turnsUsed: askData.quota.turnsUsed,
              maxTurns: askData.quota.maxTurns,
              tokensUsed: askData.quota.tokensUsed,
              maxTokens: askData.quota.maxTokens,
            }),
          });
        },
        getCadenceContent() {
          requestCount += 1;
          options.beforeProcedure?.('getCadenceContent');
          return create(GetCadenceContentResponseSchema, {
            contentJson: JSON.stringify(cadenceData.content),
            presets: [],
          });
        },
        getContactContent() {
          requestCount += 1;
          options.beforeProcedure?.('getContactContent');
          return create(GetContactContentResponseSchema, {
            contentJson: JSON.stringify(contactData.content),
          });
        },
      });
      router.service(AnalyticsService, {
        recordSsrHit() {
          requestCount += 1;
          options.beforeProcedure?.('recordSsrHit');
          return create(RecordSsrHitResponseSchema, {
            sessionId: 'stub-ssr-session',
          });
        },
      });
      router.service(CadenceService, {
        listRuns() {
          requestCount += 1;
          options.beforeProcedure?.('listCadenceRuns');
          return create(ListRunsResponseSchema, {
            runs: [],
            goldenRuns: [],
          });
        },
      });
    },
  });

  const sessions = new Set<http2.ServerHttp2Session>();
  const server = http2.createServer(handler);
  server.on('session', session => {
    sessions.add(session);
    session.on('close', () => sessions.delete(session));
  });

  await new Promise<void>(resolveListen => {
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const addr = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    getRequestCount: () => requestCount,
    resetRequestCount: () => {
      requestCount = 0;
    },
    close: async () => {
      for (const session of sessions) {
        session.destroy();
      }
      await new Promise<void>(resolveClose => server.close(() => resolveClose()));
    },
  };
}
