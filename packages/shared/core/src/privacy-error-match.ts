import {
  PrivacySanitizationFindingSchema,
  type PrivacySanitizationFinding,
} from './career-dossiers.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPrivacySanitizationErrorLike(node: unknown): boolean {
  if (!isRecord(node)) {
    return false;
  }
  return (
    node['name'] === 'PrivacySanitizationError' ||
    (node['code'] === 'ERR_CONSTRAINT' && node['status'] === 422 && Array.isArray(node['findings']))
  );
}

export function extractPrivacySanitizationFindings(
  error: unknown,
): readonly PrivacySanitizationFinding[] | null {
  const visited = new WeakSet<object>();
  let current: unknown = error;
  for (let depth = 0; depth < 6 && isRecord(current); depth += 1) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    if (isPrivacySanitizationErrorLike(current) && Array.isArray(current['findings'])) {
      const parsed: PrivacySanitizationFinding[] = [];
      for (const item of current['findings']) {
        const result = PrivacySanitizationFindingSchema.safeParse(item);
        if (result.success) {
          parsed.push(result.data);
        }
      }
      return parsed;
    }
    current = current['cause'];
  }
  return null;
}
