import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

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
  Meter,
  NavigationMenu,
  NumberField,
  OscStatusBadge,
  OTPField,
  Popover,
  PreviewCard,
  Progress,
  QrCodeSvg,
  Radio,
  RadioGroup,
  ScrollArea,
  Select,
  Separator,
  Slider,
  SolarForgeEmblem,
  StatusPill,
  Switch,
  Tabs,
  Toast,
  Toggle,
  ToggleGroup,
  Toolbar,
  Tooltip,
  ViewportProvider,
} from '../src';

describe('adaptive mobile views across @aklapper/ui elements', () => {
  it('stamps data-viewport="mobile-portrait" and data-mobile-sheet="true" on portaled overlays in document.body', () => {
    render(
      <ViewportProvider mode='mobile-portrait'>
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Backdrop data-testid='dialog-backdrop' />
            <Dialog.Viewport data-testid='dialog-viewport'>
              <Dialog.Popup data-testid='dialog-popup'>
                <Dialog.Title>Dialog Sheet</Dialog.Title>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>

        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <AlertDialog.Viewport data-testid='alert-viewport'>
              <AlertDialog.Popup data-testid='alert-popup'>
                <AlertDialog.Title>Alert Sheet</AlertDialog.Title>
              </AlertDialog.Popup>
            </AlertDialog.Viewport>
          </AlertDialog.Portal>
        </AlertDialog.Root>

        <Select.Root open>
          <Select.Trigger>Pick</Select.Trigger>
          <Select.Portal>
            <Select.Positioner data-testid='select-positioner'>
              <Select.Popup data-testid='select-popup'>
                <Select.List>
                  <Select.Item value='a'>Alpha</Select.Item>
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>

        <Combobox.Root open items={['one']}>
          <Combobox.Input aria-label='Combo' />
          <Combobox.Portal>
            <Combobox.Positioner data-testid='combobox-positioner'>
              <Combobox.Popup data-testid='combobox-popup'>
                <Combobox.List>
                  <Combobox.Item value='one'>One</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>

        <Autocomplete.Root open items={['alpha']}>
          <Autocomplete.Input aria-label='Auto' />
          <Autocomplete.Portal>
            <Autocomplete.Positioner data-testid='autocomplete-positioner'>
              <Autocomplete.Popup data-testid='autocomplete-popup'>
                <Autocomplete.List>
                  <Autocomplete.Item value='alpha'>Alpha</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>

        <Menu.Root open>
          <Menu.Trigger>Menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid='menu-positioner'>
              <Menu.Popup data-testid='menu-popup'>
                <Menu.Item>Action</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <ContextMenu.Root open>
          <ContextMenu.Trigger>Context</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner data-testid='contextmenu-positioner'>
              <ContextMenu.Popup data-testid='contextmenu-popup'>
                <ContextMenu.Item>Inspect</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>

        <Popover.Root open>
          <Popover.Trigger>Info</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner data-testid='popover-positioner'>
              <Popover.Popup data-testid='popover-popup'>Popover Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        <PreviewCard.Root open>
          <PreviewCard.Trigger href='#preview'>Preview</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid='preview-positioner'>
              <PreviewCard.Popup data-testid='preview-popup'>Card</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      </ViewportProvider>,
    );

    const popupIds = [
      'dialog-popup',
      'alert-popup',
      'select-popup',
      'combobox-popup',
      'autocomplete-popup',
      'menu-popup',
      'contextmenu-popup',
      'popover-popup',
      'preview-popup',
    ];

    for (const id of popupIds) {
      const el = screen.getByTestId(id);
      expect(el.getAttribute('data-viewport')).toBe('mobile-portrait');
      expect(el.getAttribute('data-mobile-sheet')).toBe('true');
    }

    const positionerIds = [
      'select-positioner',
      'combobox-positioner',
      'autocomplete-positioner',
      'menu-positioner',
      'contextmenu-positioner',
      'popover-positioner',
      'preview-positioner',
    ];

    for (const id of positionerIds) {
      expect(screen.getByTestId(id).getAttribute('data-viewport')).toBe('mobile-portrait');
    }
  });

  it('adapts Tooltip for tap on mobile while keeping desktop Tooltip.Trigger free of aria-haspopup', () => {
    const { rerender } = render(
      <ViewportProvider mode='desktop'>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid='tip-trigger'>Help</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Desktop tip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </ViewportProvider>,
    );

    const desktopTrigger = screen.getByTestId('tip-trigger');
    expect(desktopTrigger.hasAttribute('aria-haspopup')).toBe(false);

    rerender(
      <ViewportProvider mode='mobile-portrait'>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid='tip-trigger'>Help</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid='tip-pos'>
                <Tooltip.Popup data-testid='tip-popup'>Mobile tap tip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </ViewportProvider>,
    );

    const trigger = screen.getByTestId('tip-trigger');
    fireEvent.pointerDown(trigger);
    fireEvent.focus(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);

    expect(screen.getByTestId('tip-popup').textContent).toBe('Mobile tap tip');
    expect(screen.getByTestId('tip-popup').getAttribute('data-viewport')).toBe('mobile-portrait');

    fireEvent.pointerDown(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByTestId('tip-popup')).toBeNull();
  });

  it('supports controlled Tooltip.Root on mobile tap and preserves explicit data-viewport on Button and Input', () => {
    function ControlledMobileTooltip() {
      const [open, setOpen] = useState(false);
      return (
        <ViewportProvider mode='mobile-portrait'>
          <Tooltip.Provider>
            <Tooltip.Root open={open} onOpenChange={next => setOpen(next)}>
              <Tooltip.Trigger data-testid='ctrl-tip-trigger'>Controlled</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid='ctrl-tip-popup'>Controlled mobile tip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <Button.Root data-viewport='desktop' data-testid='explicit-btn'>
            Desktop Button
          </Button.Root>
          <Input.Root data-viewport='desktop' data-testid='explicit-input' aria-label='Desktop' />
        </ViewportProvider>
      );
    }

    render(<ControlledMobileTooltip />);

    const trigger = screen.getByTestId('ctrl-tip-trigger');
    fireEvent.pointerDown(trigger);
    fireEvent.focus(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
    expect(screen.getByTestId('ctrl-tip-popup').textContent).toBe('Controlled mobile tip');

    expect(screen.getByTestId('explicit-btn').getAttribute('data-viewport')).toBe('desktop');
    expect(screen.getByTestId('explicit-input').getAttribute('data-viewport')).toBe('desktop');
  });

  it('respects explicit viewMode override on elements inside desktop ViewportProvider', () => {
    render(
      <ViewportProvider mode='desktop'>
        <Button.Root viewMode='mobile' data-testid='override-btn'>
          Touch Action
        </Button.Root>
        <Input.Root viewMode='mobile' data-testid='override-input' aria-label='Mobile input' />
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Viewport viewMode='mobile' data-testid='override-viewport'>
              <Dialog.Popup viewMode='mobile' data-testid='override-dialog'>
                Forced Mobile Sheet
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      </ViewportProvider>,
    );

    expect(screen.getByTestId('override-btn').getAttribute('data-viewport')).toBe(
      'mobile-portrait',
    );
    expect(screen.getByTestId('override-input').getAttribute('data-viewport')).toBe(
      'mobile-portrait',
    );
    expect(screen.getByTestId('override-dialog').getAttribute('data-viewport')).toBe(
      'mobile-portrait',
    );
    expect(screen.getByTestId('override-dialog').getAttribute('data-mobile-sheet')).toBe('true');
  });

  it('renders remaining visual Base UI primitives and custom elements cleanly under mobile-portrait while keeping CSPProvider and DirectionProvider pass-through', () => {
    const { container } = render(
      <CSPProvider.Provider nonce='test-nonce'>
        <DirectionProvider.Provider direction='ltr'>
          <ViewportProvider mode='mobile-portrait'>
            <Accordion.Root>
              <Accordion.Item value='a'>
                <Accordion.Header>
                  <Accordion.Trigger>Section</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel>Body</Accordion.Panel>
              </Accordion.Item>
            </Accordion.Root>
            <Avatar.Root>
              <Avatar.Fallback>AK</Avatar.Fallback>
            </Avatar.Root>
            <CheckboxGroup.Root>
              <Checkbox.Root aria-label='Check'>
                <Checkbox.Indicator />
              </Checkbox.Root>
            </CheckboxGroup.Root>
            <Collapsible.Root>
              <Collapsible.Trigger>Toggle</Collapsible.Trigger>
              <Collapsible.Panel>Details</Collapsible.Panel>
            </Collapsible.Root>
            <Drawer.Root>
              <Drawer.Trigger>Open Drawer</Drawer.Trigger>
            </Drawer.Root>
            <Fieldset.Root>
              <Fieldset.Legend>Legend</Fieldset.Legend>
              <Field.Root>
                <Field.Label>Name</Field.Label>
                <Input.Root aria-label='Name' />
              </Field.Root>
            </Fieldset.Root>
            <Form.Root />
            <Menubar.Root />
            <Meter.Root value={50}>
              <Meter.Track>
                <Meter.Indicator />
              </Meter.Track>
            </Meter.Root>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item>
                  <NavigationMenu.Link href='#nav'>Nav</NavigationMenu.Link>
                </NavigationMenu.Item>
              </NavigationMenu.List>
            </NavigationMenu.Root>
            <NumberField.Root defaultValue={1}>
              <NumberField.Group>
                <NumberField.Decrement>-</NumberField.Decrement>
                <NumberField.Input aria-label='Qty' />
                <NumberField.Increment>+</NumberField.Increment>
              </NumberField.Group>
            </NumberField.Root>
            <OTPField.Root length={4}>
              <OTPField.Input aria-label='Digit 1' />
            </OTPField.Root>
            <Progress.Root value={72}>
              <Progress.Track>
                <Progress.Indicator />
              </Progress.Track>
            </Progress.Root>
            <RadioGroup.Root defaultValue='a'>
              <Radio.Root value='a' aria-label='Option A'>
                <Radio.Indicator />
              </Radio.Root>
            </RadioGroup.Root>
            <ScrollArea.Root>
              <ScrollArea.Viewport>
                <ScrollArea.Content>Scroll</ScrollArea.Content>
              </ScrollArea.Viewport>
            </ScrollArea.Root>
            <Separator.Root />
            <Slider.Root defaultValue={25}>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb aria-label='Volume' />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
            <Switch.Root aria-label='Enabled'>
              <Switch.Thumb />
            </Switch.Root>
            <Tabs.Root defaultValue='t1'>
              <Tabs.List>
                <Tabs.Tab value='t1'>Tab 1</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value='t1'>Panel 1</Tabs.Panel>
            </Tabs.Root>
            <Toast.Provider>
              <Toast.Viewport />
            </Toast.Provider>
            <ToggleGroup.Root>
              <Toggle.Root value='bold'>B</Toggle.Root>
            </ToggleGroup.Root>
            <Toolbar.Root>
              <Toolbar.Button>Run</Toolbar.Button>
            </Toolbar.Root>
            <OscStatusBadge source='gke-autopilot' state='ready' label='2 pods' />
            <QrCodeSvg value='https://andrew-k.us' label='Portal QR' />
            <SolarForgeEmblem size={24} />
            <StatusPill tone='success'>OK</StatusPill>
          </ViewportProvider>
        </DirectionProvider.Provider>
      </CSPProvider.Provider>,
    );

    expect(container.querySelectorAll('button, input').length).toBeGreaterThan(5);
    expect(screen.getByText('2 pods')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
  });
});
