import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ASSETS_DIR = resolve(import.meta.dirname, '../../dist/client/assets');
const STATIC_IMPORT_RE =
  /(?:^|[;,\n}])\s*(?:import|export)(?:\s*(?:\*|\{[^}]*\}|[A-Za-z0-9_$,\s]+)\s*from\s*)?["']\.\/([^"']+\.js)["']/g;

function collectStaticImportClosure(assetsDir: string, entryPatterns: readonly RegExp[]) {
  const allJsFiles = readdirSync(assetsDir).filter(file => file.endsWith('.js'));
  const entryFiles = allJsFiles.filter(file => entryPatterns.some(pattern => pattern.test(file)));
  const visited = new Set<string>();
  const queue = [...entryFiles];

  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const fullPath = join(assetsDir, file);
    if (!existsSync(fullPath)) continue;
    const source = readFileSync(fullPath, 'utf8');
    for (const match of source.matchAll(STATIC_IMPORT_RE)) {
      const target = match[1];
      if (target && !visited.has(target)) {
        queue.push(target);
      }
    }
  }

  const combinedSource = [...visited]
    .map(file => readFileSync(join(assetsDir, file), 'utf8'))
    .join('\n');

  return {
    allJsFiles,
    entryFiles,
    closureFiles: [...visited].sort(),
    combinedSource,
  };
}

describe.runIf(existsSync(ASSETS_DIR))('Portal production client chunk isolation', () => {
  it('omits off-screen pane adapters and SSE controller from the / static closure and emits zero changes-in-progress chunks', () => {
    const { allJsFiles, entryFiles, closureFiles, combinedSource } = collectStaticImportClosure(
      ASSETS_DIR,
      [/^entry\.client-/, /^root-/, /^home-/],
    );

    expect(entryFiles.length).toBeGreaterThanOrEqual(3);

    for (const forbiddenChunk of [
      /^AgensiFeatureView-/,
      /^ChatFeatureView-/,
      /^CadenceFeatureView-/,
      /^ContactFeatureView-/,
      /^cadence-stream-/,
    ]) {
      expect(closureFiles.some(file => forbiddenChunk.test(file))).toBe(false);
    }

    for (const forbiddenMarker of [
      'ask-workspace',
      'cadence-preset-select',
      'agensi-catalog-meta',
      'useCadenceRunController',
      'PortalAgensiPage',
      'PortalAskPage',
      'PortalCadencePage',
      'PortalContactPage',
    ]) {
      expect(combinedSource).not.toContain(forbiddenMarker);
    }

    expect(allJsFiles.some(file => file.startsWith('AgensiFeatureView-'))).toBe(true);
    expect(allJsFiles.some(file => file.startsWith('ChatFeatureView-'))).toBe(true);
    expect(allJsFiles.some(file => file.startsWith('CadenceFeatureView-'))).toBe(true);
    expect(allJsFiles.some(file => file.startsWith('ContactFeatureView-'))).toBe(true);
    expect(allJsFiles.some(file => file.startsWith('changes-in-progress-'))).toBe(false);
    const portraitWebpFiles = readdirSync(ASSETS_DIR).filter(
      file => file.startsWith('andrew-klapper-portrait-') && file.endsWith('.webp'),
    );
    expect(portraitWebpFiles).toHaveLength(1);
  });
});
