export { Code, ConnectError } from '@connectrpc/connect';
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
  classifyGrpcError,
  GrpcPayloadContractError,
  isFallbackTransportError,
  mapProtoFieldErrorsToDomain,
  mapProtoQuotaToDomain,
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
