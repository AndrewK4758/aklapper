/**
 * Strips ASCII control characters (`0x00`–`0x1f`, `0x7f`), trims surrounding whitespace, and caps
 * the resulting string to `maxLen` characters. Returns `null` when empty.
 */
export function sanitizeControlChars(
  raw: string | null | undefined,
  maxLen: number,
): string | null {
  if (!raw) return null;
  let cleaned = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code > 0x1f && code !== 0x7f) {
      cleaned += raw[i];
    }
  }
  const trimmed = cleaned.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

/**
 * Emits a structured workspace/client seam telemetry event to the console severity channel matching
 * its `seamType`.
 */
export function emitStructuredSeamConsoleEvent(event: { readonly seamType: string }): void {
  if (typeof console === 'undefined') {
    return;
  }
  const serialized = JSON.stringify(event);
  if (event.seamType === 'UNSOUND_CONDITION') {
    console.error(serialized);
  } else if (event.seamType === 'BOUNDARY_FAULT' || event.seamType === 'DELTA_AUDIT_GAP') {
    console.warn(serialized);
  } else {
    console.debug(serialized);
  }
}
