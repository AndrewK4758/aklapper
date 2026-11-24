import { DEFAULT_MENU_ITEMS, QDRANT_COLLECTIONS, menuItems, sandboxRuns } from '../src/index.ts';

describe('@aklapper/db', () => {
  it('defines Drizzle tables and Qdrant vector collections', () => {
    expect(menuItems.slug.name).toBe('slug');
    expect(sandboxRuns.artifactHtml.name).toBe('artifact_html');
    expect(QDRANT_COLLECTIONS.map(c => c.name)).toEqual([
      'ak_dossier',
      'cadence_patterns',
      'verified_artifacts',
    ]);
    expect(DEFAULT_MENU_ITEMS.some(item => item.adminOnly)).toBe(true);
  });
});
