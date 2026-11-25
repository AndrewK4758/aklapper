import type { AgensiCatalogMeta, AgensiSkill } from './agensi.ts';
import type { AskServiceStatus } from './ask.ts';
import type { AuthSession, QuotaStatus } from './auth.ts';
import type { FormDefinition } from './forms.ts';
import type {
  AdminChromeContent,
  AdminHomeContent,
  CadencePreset,
  CadenceRunResult,
  DocumentSeoRuntimeConfig,
  MenuItem,
  PortalAgensiContent,
  PortalAskContent,
  PortalCadenceContent,
  PortalChromeContent,
  PortalContactContent,
  PortalHomeContent,
  PortalMaintenanceContent,
  PortalMenuContent,
  RoadmapMilestone,
} from './portal.ts';
import type { TerminalProfileData } from './terminal.ts';

export interface PortalMaintenanceLoaderData {
  content: PortalMaintenanceContent;
  terminal: TerminalProfileData;
  milestones: readonly RoadmapMilestone[];
}

export interface PortalRootLoaderData {
  maintenanceMode: boolean;
  chrome: PortalChromeContent;
  maintenance: PortalMaintenanceLoaderData | null;
  terminal?: TerminalProfileData;
  homeContent?: PortalHomeContent;
  contactForm?: FormDefinition;
  runtimeSeo?: DocumentSeoRuntimeConfig;
}

export interface PortalHomeLoaderData {
  content: PortalHomeContent;
  terminal: TerminalProfileData;
  contactForm: FormDefinition;
}

export interface PortalMenuLoaderData {
  content: PortalMenuContent;
  items: readonly MenuItem[];
}

export interface PortalAgensiLoaderData {
  content: PortalAgensiContent;
  skills: readonly AgensiSkill[];
  catalogMeta?: AgensiCatalogMeta;
}

export interface PortalAskLoaderData {
  content: PortalAskContent;
  quota: QuotaStatus;
  askStatus?: AskServiceStatus;
}

export interface PortalCadenceLoaderData {
  content: PortalCadenceContent;
  presets: readonly CadencePreset[];
  quota?: QuotaStatus;
  recentRuns?: readonly CadenceRunResult[];
}

export interface PortalContactLoaderData {
  content: PortalContactContent;
}

export interface AdminRootLoaderData {
  chrome: AdminChromeContent;
  terminal?: TerminalProfileData;
  session?: AuthSession | null;
  authMeta?: {
    totpEnabled: boolean;
    passkeyCount: number;
  };
  runtimeSeo?: DocumentSeoRuntimeConfig;
}

export interface AdminHomeLoaderData {
  content: AdminHomeContent;
  menuItems: readonly MenuItem[];
}

export interface AdminAnalyticsSummary {
  totalSessions: number;
  totalEvents: number;
}
