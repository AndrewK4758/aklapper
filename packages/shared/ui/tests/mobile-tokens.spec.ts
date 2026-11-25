import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SF_MOBILE_TOKENS, SF_TOKENS, sfVar } from '../src';

const STYLES_DIR = join(import.meta.dirname, '..', 'src', 'styles');

describe('mobile CSS token layer', () => {
  it('imports tokens/mobile.css from tokens.css and declares all rules inside @layer tokens', () => {
    const tokensCss = readFileSync(join(STYLES_DIR, 'tokens.css'), 'utf8');
    expect(tokensCss).toContain("@import './tokens/mobile.css';");

    const mobileCss = readFileSync(join(STYLES_DIR, 'tokens', 'mobile.css'), 'utf8');
    expect(mobileCss.trimStart().startsWith('@layer tokens {')).toBe(true);
  });

  it('defines required touch, input floor, safe-area, dock, sheet, z-index, and coarse-pointer tokens', () => {
    const mobileCss = readFileSync(join(STYLES_DIR, 'tokens', 'mobile.css'), 'utf8');
    const requiredTokens = [
      '--sf-mobile-touch-min: 2.75rem',
      '--sf-mobile-input-font-size: 1rem',
      '--sf-safe-top:',
      '--sf-safe-right:',
      '--sf-safe-bottom:',
      '--sf-safe-left:',
      '--sf-mobile-header-h:',
      '--sf-mobile-dock-h:',
      '--sf-mobile-rail-w:',
      '--sf-mobile-rail-expanded-w:',
      '--sf-mobile-sheet-radius:',
      '--sf-mobile-sheet-shadow:',
      '--sf-mobile-sheet-max-h:',
      '--sf-z-mobile-dock:',
      '--sf-z-mobile-accessory:',
      '--sf-z-mobile-sheet:',
      '--sf-mobile-active-scale:',
      '--sf-mobile-active-opacity:',
    ];
    for (const tokenDecl of requiredTokens) {
      expect(mobileCss).toContain(tokenDecl);
    }

    expect(SF_MOBILE_TOKENS.touchMin).toBe('--sf-mobile-touch-min');
    expect(SF_MOBILE_TOKENS.inputFontSize).toBe('--sf-mobile-input-font-size');
    expect(SF_TOKENS.mobile.dockH).toBe('--sf-mobile-dock-h');
    expect(sfVar(SF_MOBILE_TOKENS.safeBottom)).toBe('var(--sf-safe-bottom)');
  });

  it('does not override palette or accent color tokens so solar-forge, high-contrast, and admin vermilion pass through', () => {
    const mobileCss = readFileSync(join(STYLES_DIR, 'tokens', 'mobile.css'), 'utf8');
    const forbiddenColorOverrides = [
      /--sf-gold\s*:/,
      /--sf-vermilion\s*:/,
      /--sf-accent-border\s*:/,
      /--sf-bg-[a-z0-9-]+\s*:/,
      /--sf-fg-[a-z0-9-]+\s*:/,
    ];
    for (const pattern of forbiddenColorOverrides) {
      expect(mobileCss).not.toMatch(pattern);
    }
  });

  it('supports data-viewport selectors, @media fallbacks including compact <= 26rem tier, and desktop reset protection', () => {
    const mobileCss = readFileSync(join(STYLES_DIR, 'tokens', 'mobile.css'), 'utf8');
    expect(mobileCss).toContain("[data-viewport='mobile-portrait']");
    expect(mobileCss).toContain("[data-viewport='mobile-landscape']");
    expect(mobileCss).toContain("[data-viewport='desktop']");
    expect(mobileCss).toContain('@media (max-width: 48rem)');
    expect(mobileCss).toContain('@media (max-height: 32rem) and (orientation: landscape)');
    expect(mobileCss).toContain('@media (max-width: 26rem)');
    expect(mobileCss).toContain('@media (pointer: coarse)');
  });
});
