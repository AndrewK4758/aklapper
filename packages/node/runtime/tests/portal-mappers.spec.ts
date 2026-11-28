import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';

import {
  classifyGrpcError,
  GrpcPayloadContractError,
  IDEMPOTENT_OIDC_RETRY_PROCEDURES,
  mapProtoAgensiCatalogMetaToDomain,
  mapProtoAgensiSkillToDomain,
  mapProtoCadencePresetToDomain,
  mapProtoCareerDossierToDomain,
  mapProtoContactSummaryToDomain,
  mapProtoTerminalProfileToDomain,
  signInternalClientIpHeader,
} from '../src/grpc.ts';
import {
  ErrorDetailEnvelopeSchema,
  FieldErrorListSchema,
  PublicAppErrorSchema,
} from '../src/grpc/gen/common/v1/error_pb.ts';
import { AgensiCatalogMetaSchema, AgensiSkillSchema } from '../src/grpc/gen/portal/v1/agensi_pb.ts';
import { ContactSubmissionSummarySchema } from '../src/grpc/gen/portal/v1/contact_pb.ts';
import {
  CadencePresetSchema,
  CareerDossierSchema,
  TerminalProfileDataSchema,
} from '../src/grpc/gen/portal/v1/content_pb.ts';
import { verifyInternalAuthToken } from '../src/http.ts';

describe('@aklapper/node-runtime/grpc portal contracts, signed client IP, and error details', () => {
  it('signs valid IPv4/IPv6 x-internal-client-ip tokens and fails closed on invalid input', () => {
    const secret = 'test-client-ip-signing-secret';
    const ipv4Token = signInternalClientIpHeader('198.51.100.42', secret);
    const claims4 = verifyInternalAuthToken(ipv4Token, secret);
    expect(claims4?.role).toBe('service');
    expect(claims4?.sub).toBe('client-ip:198.51.100.42');

    const ipv6Token = signInternalClientIpHeader('2001:db8::1', secret);
    const claims6 = verifyInternalAuthToken(ipv6Token, secret);
    expect(claims6?.sub).toBe('client-ip:2001:db8::1');

    expect(() => signInternalClientIpHeader('', secret)).toThrow('invalid IP address');
    expect(() => signInternalClientIpHeader('not-an-ip;drop', secret)).toThrow(
      'invalid IP address',
    );
  });

  it('decodes field_errors and retry_after_seconds from ConnectError details and distinguishes 422 DB constraints from privacy rejections', () => {
    const constraintErr = new ConnectError(
      'constraint failed',
      Code.FailedPrecondition,
      undefined,
      [
        {
          desc: ErrorDetailEnvelopeSchema,
          value: create(ErrorDetailEnvelopeSchema, {
            error: create(PublicAppErrorSchema, {
              code: 'ERR_CONSTRAINT',
              status: 422,
              message: 'Database constraint rejected Email format.',
              action: 'Check highlighted fields and retry.',
              correlationId: 'cid-contact-422',
              fieldErrors: {
                email: create(FieldErrorListSchema, {
                  messages: ['Database constraint rejected Email format.'],
                }),
              },
            }),
          }),
        },
      ],
    );

    const classified422 = classifyGrpcError(constraintErr, {
      correlationId: 'cid-contact-422',
      source: 'portal.contact.submit',
    });
    expect(classified422.publicError.status).toBe(422);
    expect(classified422.publicError.code).toBe('ERR_CONSTRAINT');
    expect(classified422.publicError.message).toBe('Data failed storage validation.');
    expect(classified422.publicError.fieldErrors).toEqual({
      email: ['Database constraint rejected Email format.'],
    });

    const rateLimitErr = new ConnectError('rate limited', Code.ResourceExhausted, undefined, [
      {
        desc: ErrorDetailEnvelopeSchema,
        value: create(ErrorDetailEnvelopeSchema, {
          error: create(PublicAppErrorSchema, {
            code: 'ERR_RATE_LIMITED',
            status: 429,
            message: 'Too many requests received.',
            action: 'Wait a moment and submit again.',
            correlationId: 'cid-rl-429',
          }),
          retryAfterSeconds: 47,
        }),
      },
    ]);
    const classified429 = classifyGrpcError(rateLimitErr, {
      correlationId: 'cid-rl-429',
      source: 'portal.analytics.ingest',
    });
    expect(classified429.publicError.status).toBe(429);
    expect(classified429.retryAfterSeconds).toBe(47);
  });

  it('includes read-only portal RPCs in IDEMPOTENT_OIDC_RETRY_PROCEDURES and strictly excludes mutating RPCs', () => {
    for (const readOnly of [
      '/portal.v1.PortalContentService/GetRootContent',
      '/portal.v1.PortalContentService/GetHomeContent',
      '/portal.v1.PortalContentService/GetAboutContent',
      '/portal.v1.PortalContentService/GetAskContent',
      '/portal.v1.PortalContentService/GetCadenceContent',
      '/portal.v1.PortalContentService/GetContactContent',
      '/portal.v1.AgensiService/GetCatalog',
    ]) {
      expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has(readOnly)).toBe(true);
    }

    for (const mutating of [
      '/portal.v1.AnalyticsService/IngestAnalytics',
      '/portal.v1.AnalyticsService/RecordSsrHit',
      '/portal.v1.AnalyticsService/BindGuestSession',
      '/portal.v1.ContactService/SubmitContact',
      '/cadence.v1.CadenceService/ClearSessionRuns',
    ]) {
      expect(IDEMPOTENT_OIDC_RETRY_PROCEDURES.has(mutating)).toBe(false);
    }
  });

  it('maps valid portal proto DTOs cleanly and throws GrpcPayloadContractError on malformed payloads', () => {
    const profile = mapProtoTerminalProfileToDomain(
      create(TerminalProfileDataSchema, {
        slug: 'portal-home',
        bannerTitle: 'Solar Forge',
        bannerMeta: 'tty1',
        osLabel: '⚡',
        directory: '~/aklapper',
        vcsBranch: 'main',
        vcsState: 'clean',
        contextLabel: 'guest',
        placeholder: 'type',
        quickCommands: ['help'],
        initialEntries: [],
        commands: [],
      }),
    );
    expect(profile.slug).toBe('portal-home');
    expect(() => mapProtoTerminalProfileToDomain(undefined)).toThrow(GrpcPayloadContractError);

    const dossier = mapProtoCareerDossierToDomain(
      create(CareerDossierSchema, {
        slug: 'd-1',
        kind: 'experience',
        title: 'Engineer',
        domainLabel: 'Systems',
        roleTitle: 'Senior Engineer',
        timeframe: 'Present',
        skills: ['Go'],
        summaryBody: 'Summary',
        sections: [{ heading: 'Overview', body: 'Details' }],
        publishStatus: 'published',
        sanitizationVerifiedAt: '2026-11-26T00:00:00.000Z',
        denylistHash: 'a'.repeat(64),
        sortOrder: 1,
        updatedAt: '2026-11-26T00:00:00.000Z',
      }),
    );
    expect(dossier.slug).toBe('d-1');

    const preset = mapProtoCadencePresetToDomain(
      create(CadencePresetSchema, {
        slug: 'p-1',
        title: 'Preset',
        starterPrompt: 'Build',
        expectedKind: 'workbench',
        starterArtifactHtml: '<div/>',
        sortOrder: 1,
      }),
    );
    expect(preset.slug).toBe('p-1');

    const skill = mapProtoAgensiSkillToDomain(
      create(AgensiSkillSchema, {
        slug: 's-1',
        name: 'Skill',
        summary: 'Summary',
        tags: ['go'],
        url: 'https://agensi.io/skills/s-1',
        sortOrder: 1,
        creatorHandle: 'aklapper',
        isPublished: true,
        source: 'agensi_api',
      }),
    );
    expect(skill.slug).toBe('s-1');

    const meta = mapProtoAgensiCatalogMetaToDomain(
      create(AgensiCatalogMetaSchema, {
        mode: 'live',
        creatorHandle: 'aklapper',
        syncedAt: '2026-11-26T00:00:00.000Z',
      }),
    );
    expect(meta.mode).toBe('live');

    const summary = mapProtoContactSummaryToDomain(
      create(ContactSubmissionSummarySchema, {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        createdAt: '2026-11-26T00:00:00.000Z',
      }),
    );
    expect(summary.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(() => mapProtoContactSummaryToDomain(undefined)).toThrow(GrpcPayloadContractError);
  });
});
