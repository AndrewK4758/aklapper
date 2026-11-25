import type { QuotaStatus, Role } from './auth.ts';
import type { MenuItem } from './portal.ts';

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}

export function filterMenuForRole(items: readonly MenuItem[], role: Role): MenuItem[] {
  return items
    .filter(item => item.enabled && (isAdminRole(role) || !item.adminOnly))
    .toSorted((a, b) => a.sortOrder - b.sortOrder);
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
