import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as UI from '../src';
import {
  Accordion,
  AlertDialog,
  Autocomplete,
  Avatar,
  Button,
  Checkbox,
  CheckboxGroup,
  Collapsible,
  Combobox,
  ContextMenu,
  CSPProvider,
  Dialog,
  DirectionProvider,
  Drawer,
  Field,
  Fieldset,
  Form,
  Input,
  Menu,
  Menubar,
  mergeBaseClassName,
  Meter,
  NavigationMenu,
  NumberField,
  OTPField,
  Popover,
  PreviewCard,
  Progress,
  Radio,
  RadioGroup,
  ScrollArea,
  Select,
  Separator,
  SF_TOKENS,
  sfVar,
  Slider,
  Switch,
  Tabs,
  Toast,
  Toggle,
  ToggleGroup,
  Toolbar,
  Tooltip,
} from '../src';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '../src');
const stylesDir = resolve(srcDir, 'styles');

function collectCssFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectCssFiles(full));
    } else if (entry.name.endsWith('.css')) {
      results.push(full);
    }
  }
  return results;
}

describe('@aklapper/ui design tokens', () => {
  it('defines Fira Code Nerd Font, OKLCH colors, relative calc() spacing/layout, and animations inside @layer tokens', () => {
    const typographyCss = readFileSync(resolve(stylesDir, 'tokens/typography.css'), 'utf8');
    const layoutCss = readFileSync(resolve(stylesDir, 'tokens/layout.css'), 'utf8');
    const animationsCss = readFileSync(resolve(stylesDir, 'tokens/animations.css'), 'utf8');
    const colorsCss = readFileSync(resolve(stylesDir, 'tokens/colors.css'), 'utf8');

    expect(typographyCss).toContain('@layer tokens');
    expect(typographyCss).toContain("'FiraCode Nerd Font Mono'");
    expect(typographyCss).toContain("'FiraCode Nerd Font'");
    expect(typographyCss).toContain('--sf-font-features-ligatures');
    expect(typographyCss).toContain('--sf-text-unit: 1rem;');
    expect(typographyCss).toContain('calc(var(--sf-text-unit) * 0.875)');

    const elementCss = readFileSync(resolve(stylesDir, 'element.css'), 'utf8');
    expect(elementCss).toContain('font-variant-ligatures: contextual common-ligatures;');
    expect(elementCss).toContain('font-feature-settings: var(--sf-font-features-ligatures);');

    expect(layoutCss).toContain('--sf-size-unit: 1rem;');
    expect(layoutCss).toContain('--sf-space-unit: calc(var(--sf-size-unit) * 0.25);');
    expect(layoutCss).toContain('--sf-align-center: center;');
    expect(layoutCss).toContain('--sf-justify-between: space-between;');
    expect(layoutCss).toContain('--sf-space-16: calc(var(--sf-space-unit) * 24);');
    expect(layoutCss).toContain('--sf-z-tooltip: 80;');

    expect(animationsCss).toContain('@keyframes sf-fade-in');
    expect(animationsCss).toContain('@keyframes sf-spin');
    expect(animationsCss).toContain('--sf-ease-spring');
    expect(animationsCss).toContain('--sf-motion-distance-sm: calc(var(--sf-space-unit) * 1.5);');

    expect(colorsCss).toContain('--sf-bg-frame: oklch(');
    expect(colorsCss).toContain('--sf-gold: oklch(');

    expect(sfVar(SF_TOKENS.typography.fontMono)).toBe('var(--sf-font-mono)');
    expect(sfVar(SF_TOKENS.alignment.alignCenter)).toBe('var(--sf-align-center)');
    expect(sfVar(SF_TOKENS.animation.easeSpring)).toBe('var(--sf-ease-spring)');
  });

  it('bundles all 6 FiraCode Nerd Font Mono WOFF2 weights and wires @font-face through theme.css', () => {
    const themeCss = readFileSync(resolve(stylesDir, 'theme.css'), 'utf8');
    const fontsCss = readFileSync(resolve(stylesDir, 'fonts.css'), 'utf8');

    expect(themeCss).toContain("@import './fonts.css';");
    expect(fontsCss).toContain('@layer tokens');
    expect(fontsCss).toContain("font-family: 'FiraCode Nerd Font Mono';");

    const expectedWeights = [
      { file: 'FiraCodeNerdFontMono-Light.woff2', weight: '300' },
      { file: 'FiraCodeNerdFontMono-Regular.woff2', weight: '400' },
      { file: 'FiraCodeNerdFontMono-Retina.woff2', weight: '450' },
      { file: 'FiraCodeNerdFontMono-Medium.woff2', weight: '500' },
      { file: 'FiraCodeNerdFontMono-SemiBold.woff2', weight: '600' },
      { file: 'FiraCodeNerdFontMono-Bold.woff2', weight: '700' },
    ] as const;

    for (const { file, weight } of expectedWeights) {
      expect(fontsCss).toContain(`url('./fonts/${file}') format('woff2')`);
      expect(fontsCss).toContain(`font-weight: ${weight};`);
      const bytes = readFileSync(resolve(stylesDir, 'fonts', file));
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
      expect(bytes.byteLength).toBeGreaterThan(100_000);
    }
  });

  it('uses OKLCH-only colors and relative calc() sizing with zero hex/rgb/hsl/px across UI, portal, and admin stylesheets', () => {
    const repoRoot = resolve(here, '../../../..');
    const cssFiles = [
      ...collectCssFiles(srcDir),
      ...collectCssFiles(resolve(repoRoot, 'apps/portal/portal/src')),
      ...collectCssFiles(resolve(repoRoot, 'apps/admin/admin/src')),
    ];
    expect(cssFiles.length).toBeGreaterThan(10);

    for (const file of cssFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, `${file} must not contain hex colors`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(content, `${file} must not contain rgb()/hsl() colors`).not.toMatch(
        /\b(?:rgba?|hsla?)\(/i,
      );
      expect(content, `${file} must not contain hardcoded px units`).not.toMatch(
        /\b\d+(?:\.\d+)?px\b/,
      );
    }
  });
});

describe('@aklapper/ui Base UI compound elements', () => {
  it('exports all 40 @base-ui/react element namespaces and providers', () => {
    const expectedModules = {
      Accordion,
      AlertDialog,
      Autocomplete,
      Avatar,
      Button,
      Checkbox,
      CheckboxGroup,
      Collapsible,
      Combobox,
      ContextMenu,
      CSPProvider,
      Dialog,
      DirectionProvider,
      Drawer,
      Field,
      Fieldset,
      Form,
      Input,
      Menu,
      Menubar,
      Meter,
      NavigationMenu,
      NumberField,
      OTPField,
      Popover,
      PreviewCard,
      Progress,
      Radio,
      RadioGroup,
      ScrollArea,
      Select,
      Separator,
      Slider,
      Switch,
      Tabs,
      Toast,
      Toggle,
      ToggleGroup,
      Toolbar,
      Tooltip,
    };

    expect(Object.keys(expectedModules)).toHaveLength(40);
    for (const [name, mod] of Object.entries(expectedModules)) {
      expect(mod, `expected ${name} to be defined`).toBeDefined();
      expect(name in UI, `expected ${name} to be exported from index`).toBe(true);
    }
  });

  it('merges static and render-state callback classNames cleanly', () => {
    expect(mergeBaseClassName('sf-base', undefined)).toBe('sf-base');
    expect(mergeBaseClassName('sf-base', 'custom')).toBe('sf-base custom');

    const dynamic = mergeBaseClassName('sf-base', (state: { active: boolean }) =>
      state.active ? 'is-active' : undefined,
    );
    expect(typeof dynamic).toBe('function');
    const dynamicFn = dynamic as (state: { active: boolean }) => string | undefined;
    expect(dynamicFn({ active: true })).toBe('sf-base is-active');
    expect(dynamicFn({ active: false })).toBe('sf-base');
  });

  it('renders Button with compound sections (.Root, .Icon, .Label, .Spinner) and loading state', () => {
    const onClick = vi.fn<() => void>();
    const { rerender } = render(
      <Button.Root variant='primary' size='sm' onClick={onClick}>
        <Button.Icon aria-hidden='true'>⚡</Button.Icon>
        <Button.Label>Deploy</Button.Label>
      </Button.Root>,
    );

    const btn = screen.getByRole('button', { name: 'Deploy' });
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(btn.getAttribute('data-size')).toBe('sm');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button loading variant='danger'>
        <Button.Spinner aria-hidden='true' />
        <Button.Label>Deleting</Button.Label>
      </Button>,
    );

    const loadingBtn = screen.getByRole('button', { name: 'Deleting' });
    expect(loadingBtn.hasAttribute('disabled')).toBe(true);
    expect(loadingBtn.hasAttribute('data-loading')).toBe(true);
  });

  it('renders Input, Field, Fieldset, and Form compound sections', () => {
    render(
      <Form.Root>
        <Fieldset.Root>
          <Fieldset.Legend>Credentials</Fieldset.Legend>
          <Field.Root name='handle'>
            <Field.Label>Handle</Field.Label>
            <Input.Group>
              <Input.Prefix>@</Input.Prefix>
              <Input.Root placeholder='aklapper' inputSize='md' />
              <Input.Suffix>.us</Input.Suffix>
            </Input.Group>
            <Field.Description>Public portfolio identifier</Field.Description>
          </Field.Root>
        </Fieldset.Root>
        <Form.Actions>
          <Button type='submit' variant='primary'>
            <Button.Label>Save</Button.Label>
          </Button>
        </Form.Actions>
      </Form.Root>,
    );

    expect(screen.getByText('Credentials')).toBeTruthy();
    expect(screen.getByPlaceholderText('aklapper')).toBeTruthy();
    expect(screen.getByText('Public portfolio identifier')).toBeTruthy();
  });

  it('toggles Accordion, Collapsible, Tabs, Switch, Checkbox, and Toggle interactively', () => {
    render(
      <DirectionProvider.Provider direction='ltr'>
        <CSPProvider.Provider>
          <Accordion.Root>
            <Accordion.Item value='a'>
              <Accordion.Header>
                <Accordion.Trigger>Section A</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>Panel A body</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>

          <Collapsible.Root>
            <Collapsible.Trigger>More details</Collapsible.Trigger>
            <Collapsible.Panel>Hidden details</Collapsible.Panel>
          </Collapsible.Root>

          <Tabs.Root defaultValue='one'>
            <Tabs.List>
              <Tabs.Tab value='one'>Tab One</Tabs.Tab>
              <Tabs.Tab value='two'>Tab Two</Tabs.Tab>
              <Tabs.Indicator />
            </Tabs.List>
            <Tabs.Panel value='one'>Content One</Tabs.Panel>
            <Tabs.Panel value='two'>Content Two</Tabs.Panel>
          </Tabs.Root>

          <Switch.Label>
            <Switch.Root aria-label='Maintenance'>
              <Switch.Thumb />
            </Switch.Root>
            Maintenance
          </Switch.Label>

          <Checkbox.Label>
            <Checkbox.Root aria-label='Confirm'>
              <Checkbox.Indicator>✓</Checkbox.Indicator>
            </Checkbox.Root>
            Confirm
          </Checkbox.Label>

          <ToggleGroup.Root>
            <Toggle.Root value='grid' aria-label='Grid view'>
              <Toggle.Label>Grid</Toggle.Label>
            </Toggle.Root>
          </ToggleGroup.Root>

          <Progress.Root value={64}>
            <Progress.Label>Build</Progress.Label>
            <Progress.Track>
              <Progress.Indicator />
            </Progress.Track>
            <Progress.Value />
          </Progress.Root>

          <Meter.Root value={42} min={0} max={100}>
            <Meter.Label>CPU</Meter.Label>
            <Meter.Track>
              <Meter.Indicator />
            </Meter.Track>
            <Meter.Value />
          </Meter.Root>

          <Avatar.Root>
            <Avatar.Fallback>AK</Avatar.Fallback>
          </Avatar.Root>

          <Separator.Root />
        </CSPProvider.Provider>
      </DirectionProvider.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Section A' }));
    expect(screen.getByText('Panel A body')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    expect(screen.getByText('Hidden details')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Tab Two' }));
    expect(screen.getByText('Content Two')).toBeTruthy();

    const sw = screen.getByRole('switch', { name: 'Maintenance' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');

    const cb = screen.getByRole('checkbox', { name: 'Confirm' });
    expect(cb.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(cb);
    expect(cb.getAttribute('aria-checked')).toBe('true');

    expect(screen.getByText('AK')).toBeTruthy();
  });

  it('opens and closes Dialog with Header, Title, Description, Body, and Footer sections', () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger>Open Modal</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Viewport>
            <Dialog.Popup>
              <Dialog.Header>
                <Dialog.Title>Confirm Action</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Dialog.Description>Proceed with cluster rollout?</Dialog.Description>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.Close>Cancel</Dialog.Close>
              </Dialog.Footer>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Modal' }));
    expect(screen.getByText('Confirm Action')).toBeTruthy();
    expect(screen.getByText('Proceed with cluster rollout?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Confirm Action')).toBeNull();
  });
});
