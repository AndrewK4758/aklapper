import { z } from 'zod';

export const CADENCE_PROMPT_CACHE_VERSION = 'v1';

export const CadenceExecutionModeSchema = z.enum(['golden', 'cached', 'live', 'fast', 'fallback']);
export type CadenceExecutionMode = z.infer<typeof CadenceExecutionModeSchema>;

export const CadenceSpecArtifactSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  conditions: z.array(z.string().min(1)),
  handling: z.array(z.string().min(1)),
  outcomes: z.array(z.string().min(1)),
  rules: z.array(z.string().min(1)),
  deltas: z.array(z.string().min(1)),
  recalledPatterns: z.array(z.string().min(1)).optional(),
});
export type CadenceSpecArtifact = z.infer<typeof CadenceSpecArtifactSchema>;

export const CadenceGateCheckStatusSchema = z.enum(['pass', 'warn', 'fail']);
export type CadenceGateCheckStatus = z.infer<typeof CadenceGateCheckStatusSchema>;

export const CadenceGateCheckItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: CadenceGateCheckStatusSchema,
  detail: z.string().min(1),
});
export type CadenceGateCheckItem = z.infer<typeof CadenceGateCheckItemSchema>;

export const CadenceGateAuditSchema = z.object({
  summary: z.string().min(1),
  sanitized: z.boolean(),
  artifactBytes: z.number().int().nonnegative(),
  checks: z.array(CadenceGateCheckItemSchema),
});
export type CadenceGateAudit = z.infer<typeof CadenceGateAuditSchema>;

export const CadenceStreamLogEventSchema = z.object({
  runId: z.string().min(1),
  line: z.string().min(1),
  timestamp: z.string().optional(),
});
export type CadenceStreamLogEvent = z.infer<typeof CadenceStreamLogEventSchema>;

/**
 * Canonical prompt normalizer shared byte-for-byte with Go `contracts.NormalizeCadencePrompt`:
 * trims outer whitespace, collapses internal ASCII/Unicode whitespace runs to a single space, and
 * lowercases.
 */
export function normalizeCadencePrompt(raw: string): string {
  return raw.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function buildCadencePresetRevisionInput(
  expectedKind: string,
  starterArtifactHtml: string,
): string {
  return `${expectedKind}\0${starterArtifactHtml}`;
}

export interface CadencePromptHashInput {
  readonly presetSlug: string;
  readonly presetRevisionHash: string;
  readonly mode: string;
  readonly prompt: string;
}

export function buildCadencePromptHashInput(input: CadencePromptHashInput): string {
  const canonicalPreset = input.presetSlug.trim() || 'custom';
  const canonicalMode = input.mode.trim() === 'llm' ? 'llm' : 'fast';
  const normalizedPrompt = normalizeCadencePrompt(input.prompt);
  return `${CADENCE_PROMPT_CACHE_VERSION}\0${canonicalPreset}\0${input.presetRevisionHash}\0${canonicalMode}\0${normalizedPrompt}`;
}
