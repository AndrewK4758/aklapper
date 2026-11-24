import { Menu as BaseMenu } from '@base-ui/react/menu';

import { styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const Menu = {
  Root: BaseMenu.Root,
  Trigger: styledPart(BaseMenu.Trigger, menuStyles.trigger, 'Menu.Trigger'),
  Portal: BaseMenu.Portal,
  Backdrop: styledPart(BaseMenu.Backdrop, overlayStyles.backdrop, 'Menu.Backdrop'),
  Positioner: styledPart(BaseMenu.Positioner, menuStyles.positioner, 'Menu.Positioner'),
  Popup: styledPart(BaseMenu.Popup, menuStyles.popup, 'Menu.Popup'),
  Viewport: styledPart(BaseMenu.Viewport, overlayStyles.floatingViewport, 'Menu.Viewport'),
  Arrow: styledPart(BaseMenu.Arrow, overlayStyles.arrow, 'Menu.Arrow'),
  FilterProvider: BaseMenu.FilterProvider,
  Input: styledPart(BaseMenu.Input, controlStyles.input, 'Menu.Input'),
  List: styledPart(BaseMenu.List, menuStyles.list, 'Menu.List'),
  Clear: styledPart(BaseMenu.Clear, menuStyles.clear, 'Menu.Clear'),
  Empty: styledPart(BaseMenu.Empty, menuStyles.empty, 'Menu.Empty'),
  Group: styledPart(BaseMenu.Group, menuStyles.group, 'Menu.Group'),
  GroupLabel: styledPart(BaseMenu.GroupLabel, menuStyles.groupLabel, 'Menu.GroupLabel'),
  Item: styledPart(BaseMenu.Item, menuStyles.item, 'Menu.Item'),
  LinkItem: styledPart(BaseMenu.LinkItem, menuStyles.item, 'Menu.LinkItem'),
  CheckboxItem: styledPart(BaseMenu.CheckboxItem, menuStyles.item, 'Menu.CheckboxItem'),
  CheckboxItemIndicator: styledPart(
    BaseMenu.CheckboxItemIndicator,
    menuStyles.itemIndicator,
    'Menu.CheckboxItemIndicator',
  ),
  RadioGroup: styledPart(BaseMenu.RadioGroup, menuStyles.group, 'Menu.RadioGroup'),
  RadioItem: styledPart(BaseMenu.RadioItem, menuStyles.item, 'Menu.RadioItem'),
  RadioItemIndicator: styledPart(
    BaseMenu.RadioItemIndicator,
    menuStyles.itemIndicator,
    'Menu.RadioItemIndicator',
  ),
  SubmenuRoot: BaseMenu.SubmenuRoot,
  SubmenuTrigger: styledPart(BaseMenu.SubmenuTrigger, menuStyles.item, 'Menu.SubmenuTrigger'),
  Separator: styledPart(BaseMenu.Separator, disclosureStyles.separator, 'Menu.Separator'),
  Handle: BaseMenu.Handle,
  createHandle: BaseMenu.createHandle,
  useFilter: BaseMenu.useFilter,
} as const;

export type MenuHandle<Payload = unknown> = BaseMenu.Handle<Payload>;

export type {
  MenuArrowProps,
  MenuArrowState,
  MenuBackdropProps,
  MenuBackdropState,
  MenuCheckboxItemIndicatorProps,
  MenuCheckboxItemIndicatorState,
  MenuCheckboxItemProps,
  MenuCheckboxItemState,
  MenuGroupLabelProps,
  MenuGroupLabelState,
  MenuGroupProps,
  MenuGroupState,
  MenuItemProps,
  MenuItemState,
  MenuLinkItemProps,
  MenuLinkItemState,
  MenuPopupProps,
  MenuPopupState,
  MenuPortalProps,
  MenuPortalState,
  MenuPositionerProps,
  MenuPositionerState,
  MenuRadioGroupProps,
  MenuRadioGroupState,
  MenuRadioItemIndicatorProps,
  MenuRadioItemIndicatorState,
  MenuRadioItemProps,
  MenuRadioItemState,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootProps,
  MenuRootState,
  MenuSubmenuRootProps,
  MenuSubmenuRootState,
  MenuSubmenuTriggerProps,
  MenuSubmenuTriggerState,
  MenuTriggerProps,
  MenuTriggerState,
  MenuViewportProps,
  MenuViewportState,
} from '@base-ui/react/menu';
