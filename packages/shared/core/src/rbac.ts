import type { K8sPodEvent, MenuItem, QuotaStatus, Role } from './contracts.ts';

export const ADMIN_NAMESPACE = 'cadence-admin';

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}

export function filterMenuForRole(items: readonly MenuItem[], role: Role): MenuItem[] {
  return items
    .filter(item => item.enabled && (isAdminRole(role) || !item.adminOnly))
    .toSorted((a, b) => a.sortOrder - b.sortOrder);
}

export function isPodEventVisibleToRole(event: K8sPodEvent, role: Role): boolean {
  if (isAdminRole(role)) return true;
  return event.namespace !== ADMIN_NAMESPACE;
}

export function hasRemainingBudget(quota: QuotaStatus, estimatedTokens = 0): boolean {
  return quota.turnsUsed < quota.maxTurns && quota.tokensUsed + estimatedTokens <= quota.maxTokens;
}

export function remainingBudget(quota: QuotaStatus): { turns: number; tokens: number } {
  return {
    turns: Math.max(0, quota.maxTurns - quota.turnsUsed),
    tokens: Math.max(0, quota.maxTokens - quota.tokensUsed),
  };
}
