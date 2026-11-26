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

describe.runIf(existsSync(ASSETS_DIR))('Admin production client chunk isolation', () => {
  it('omits TerminalWorkspace, ZshP10kTerminal, preview canvas, QR, and artifact frame from /login static closure', () => {
    const { allJsFiles, entryFiles, closureFiles, combinedSource } = collectStaticImportClosure(
      ASSETS_DIR,
      [/^entry\.client-/, /^root-/, /^login-/],
    );

    expect(entryFiles.length).toBeGreaterThanOrEqual(3);

    for (const forbiddenChunk of [
      /^terminal-workspace-/i,
      /^TerminalWorkspace-/,
      /^mobile-tui-workspace-/i,
      /^MobileTuiWorkspace-/,
      /^SiteContentPreviewPane-/,
      /^CmsMenuTab-/,
      /^CmsTerminalTab-/,
      /^CmsAgensiPresetsTab-/,
    ]) {
      expect(closureFiles.some(file => forbiddenChunk.test(file))).toBe(false);
    }

    for (const forbiddenMarker of [
      'ZshP10kTerminal',
      'Terminal command input',
      'MobileTuiWorkspace',
      'data-mobile-tui-dock',
      'data-pane-count',
      'SiteContentPreviewCanvas',
      'PortalHomeTerminalIntro',
      'TerminalPortrait',
      'data-terminal-portrait',
      'data-portal-home-intro',
      '/assets/andrew-klapper-portrait-',
      'QrCodeSvg',
      'SandboxedArtifactFrame',
    ]) {
      expect(combinedSource).not.toContain(forbiddenMarker);
    }

    expect(allJsFiles.some(file => /^terminal-workspace-/i.test(file))).toBe(true);
    expect(allJsFiles.some(file => /^mobile-tui-workspace-/i.test(file))).toBe(true);
    const portraitWebpFiles = readdirSync(ASSETS_DIR).filter(
      file => file.startsWith('andrew-klapper-portrait-') && file.endsWith('.webp'),
    );
    expect(portraitWebpFiles).toHaveLength(1);
  });
});
