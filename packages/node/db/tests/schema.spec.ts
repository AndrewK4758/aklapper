import {
  cadencePresets,
  DEFAULT_MENU_ITEMS,
  menuItems,
  QDRANT_COLLECTIONS,
  roadmapMilestones,
  sandboxRuns,
  SITE_CONTENT_KEYS,
  TERMINAL_PROFILE_SLUGS,
  terminalCommands,
  terminalInitialEntries,
  terminalProfiles,
} from '../src/index.ts';

describe('@aklapper/db', () => {
  it('defines Drizzle tables for portal/admin data and Qdrant vector collections', () => {
    expect(menuItems.slug.name).toBe('slug');
    expect(sandboxRuns.artifactHtml.name).toBe('artifact_html');
    expect(cadencePresets.starterArtifactHtml.name).toBe('starter_artifact_html');
    expect(terminalProfiles.quickCommands.name).toBe('quick_commands');
    expect(terminalInitialEntries.profileSlug.name).toBe('profile_slug');
    expect(terminalCommands.allowedRoutes.name).toBe('allowed_routes');
    expect(roadmapMilestones.status.name).toBe('status');
    expect(QDRANT_COLLECTIONS.map(c => c.name)).toEqual([
      'ak_dossier',
      'cadence_patterns',
      'verified_artifacts',
    ]);
    expect(DEFAULT_MENU_ITEMS.some(item => item.adminOnly)).toBe(true);
    expect(Object.keys(SITE_CONTENT_KEYS)).toHaveLength(8);
    expect(TERMINAL_PROFILE_SLUGS.portalHome).toBe('portal-home');
  });
});
