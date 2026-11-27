export { Code, ConnectError } from '@connectrpc/connect';
export {
  getAdminAnalyticsBreakdownsViaGrpc,
  getAdminAnalyticsSummaryViaGrpc,
  getAdminOverviewDataViaGrpc,
  ingestAdminAnalyticsViaGrpc,
} from './grpc/admin-analytics-client.ts';
export { handleAdminAuthGrpcBffRequest } from './grpc/admin-auth-bff.ts';
export {
  extractAdminSessionCookieId,
  resolveAdminSessionViaGrpc,
} from './grpc/admin-auth-client.ts';
export {
  deleteAdminCadencePresetViaGrpc,
  deleteAdminMenuItemViaGrpc,
  getAdminChromeViaGrpc,
  getAdminCmsDataViaGrpc,
  getAdminWorkspaceBootstrapViaGrpc,
  syncAdminAgensiCatalogViaGrpc,
  upsertAdminCadencePresetViaGrpc,
  upsertAdminMenuItemViaGrpc,
  upsertAdminSiteContentViaGrpc,
} from './grpc/admin-cms-client.ts';
export {
  deleteAdminCareerDossierViaGrpc,
  importAdminCareerDossiersBatchViaGrpc,
  listAdminCareerDossiersViaGrpc,
  publishAdminCareerDossierViaGrpc,
  unpublishAdminCareerDossierViaGrpc,
  upsertAdminCareerDossierViaGrpc,
} from './grpc/admin-cms-dossiers-client.ts';
export {
  deleteAdminTerminalCommandViaGrpc,
  deleteAdminTerminalDirectoryEntryViaGrpc,
  deleteAdminTerminalInitialEntryViaGrpc,
  upsertAdminTerminalCommandViaGrpc,
  upsertAdminTerminalDirectoryEntryViaGrpc,
  upsertAdminTerminalInitialEntryViaGrpc,
  upsertAdminTerminalProfileViaGrpc,
} from './grpc/admin-cms-terminal-client.ts';
export {
  ADMIN_CHROME_SUBJECT,
  ADMIN_SESSION_HEADER,
  buildAdminGrpcCallMeta,
  resolveAdminApiBaseUrl,
  resolveRequestClientIp,
  type AdminGrpcCallContext,
} from './grpc/admin-common.ts';
export {
  deleteAdminContactSubmissionViaGrpc,
  deleteAdminContactSubmissionsViaGrpc,
  listAdminContactSubmissionsViaGrpc,
  openAdminContactAttachmentStreamViaGrpc,
  type StreamedContactAttachment,
} from './grpc/admin-inbox-client.ts';
export {
  getAdminQdrantStatusViaGrpc,
  listAdminQuotasAndBucketsViaGrpc,
  listAdminSandboxRunsViaGrpc,
  overrideAdminSandboxGateVerdictViaGrpc,
  purgeAdminStaleRateLimitBucketsViaGrpc,
  resetAdminRateLimitBucketViaGrpc,
  updateAdminQuotaPolicyViaGrpc,
} from './grpc/admin-quotas-ops-client.ts';
export {
  callAsk,
  getAskStatus,
  getAskTurn,
  streamAsk,
  triggerReindex,
  type AskUpstreamStatusResult,
  type CallAskInput,
  type CallAskResult,
  type ReindexResult,
  type StreamAskInput,
} from './grpc/ask-client.ts';
export {
  mapProtoAskChunkToSse,
  mapProtoAskResponseToDomain,
  mapProtoAskSourceToDomain,
  mapProtoAskTurnStateToDomain,
  mapProtoPublicErrorToDomain,
} from './grpc/ask-mappers.ts';
export {
  approveCadenceSpecGate,
  clearCadenceSessionRuns,
  createCadenceRun,
  listCadenceRuns,
  streamCadenceRun,
  submitCadenceGateVerdict,
  type ApproveSpecGateResult,
  type ClearCadenceSessionRunsResult,
  type CreateCadenceRunInput,
  type CreateCadenceRunResult,
  type ListCadenceRunsInput,
  type ListCadenceRunsResult,
  type SubmitGateVerdictResult,
} from './grpc/cadence-client.ts';
export {
  CLIENT_IP_SUBJECT_PREFIX,
  INTERNAL_CLIENT_IP_HEADER,
  signInternalClientIpHeader,
} from './grpc/client-ip.ts';
export {
  mapProtoCadenceChunkToSse,
  mapProtoCadenceRunToDomain,
  mapProtoCadenceTurnToDomain,
  mapProtoPayloadValueToDomain,
} from './grpc/cadence-mappers.ts';
export {
  classifyAdminGrpcError,
  classifyGrpcError,
  GrpcPayloadContractError,
  isFallbackTransportError,
  mapProtoFieldErrorsToDomain,
  mapProtoQuotaToDomain,
  mapProtoSanitizationFindingsToDomain,
  type ClassifiedGrpcFailure,
  type ClassifyGrpcErrorContext,
} from './grpc/errors.ts';
export {
  ErrorDetailEnvelopeSchema,
  FieldErrorListSchema,
  PublicAppErrorSchema,
} from './grpc/gen/common/v1/error_pb.ts';
export {
  probeGrpcServiceHealth,
  type GrpcHealthProbeResult,
  type ProbeGrpcServiceHealthOptions,
} from './grpc/health-client.ts';
export {
  bindPortalGuestSession,
  getPortalAboutContent,
  getPortalAgensiCatalog,
  getPortalAskContent,
  getPortalCadenceContent,
  getPortalContactContent,
  getPortalHomeContent,
  getPortalRootContent,
  ingestPortalAnalytics,
  recordPortalSsrHit,
  submitPortalContact,
  type IngestPortalAnalyticsResult,
  type PortalAgensiCatalogResult,
  type PortalCadenceContentResult,
  type PortalClientRequestContextInput,
  type SubmitPortalContactInput,
} from './grpc/portal-client.ts';
export {
  mapProtoAgensiCatalogMetaToDomain,
  mapProtoAgensiSkillToDomain,
  mapProtoAgensiSyncStateToDomain,
  mapProtoCadencePresetToDomain,
  mapProtoCareerDossierToDomain,
  mapProtoContactSummaryToDomain,
  mapProtoStatusBadgeToDomain,
  mapProtoTerminalProfileToDomain,
} from './grpc/portal-mappers.ts';
export {
  startPortalApiStubServerForTest,
  type PortalApiStubServer,
  type PortalStubProcedure,
  type StartPortalApiStubServerOptions,
} from './grpc/portal-test-server.ts';
export {
  bridgeGrpcStreamToSse,
  DEFAULT_GRPC_SSE_HEARTBEAT_MS,
  type GrpcSseBridgeOptions,
  type MappedSseFrame,
} from './grpc/sse-bridge.ts';
export {
  clearGoGrpcTransportCacheForTest,
  getOrCreateGoGrpcTransport,
  IDEMPOTENT_OIDC_RETRY_PROCEDURES,
  invokeUnaryWithAuth,
  isGfeIamAuthRejection,
  openServerStreamWithAuth,
  type GrpcCallMetadata,
  type GrpcInternalAuth,
  type GrpcTransportOptions,
} from './grpc/transport.ts';
