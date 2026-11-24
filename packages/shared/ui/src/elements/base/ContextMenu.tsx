import { ContextMenu as BaseContextMenu } from '@base-ui/react/context-menu';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const ContextMenu = {
  Root: BaseContextMenu.Root,
  Trigger: BaseContextMenu.Trigger,
  Portal: BaseContextMenu.Portal,
  Backdrop: styledPart(BaseContextMenu.Backdrop, overlayStyles.backdrop, 'ContextMenu.Backdrop'),
  Positioner: styledPart(
    BaseContextMenu.Positioner,
    menuStyles.positioner,
    'ContextMenu.Positioner',
  ),
  Popup: styledPart(BaseContextMenu.Popup, menuStyles.popup, 'ContextMenu.Popup'),
  Arrow: styledPart(BaseContextMenu.Arrow, overlayStyles.arrow, 'ContextMenu.Arrow'),
  Group: styledPart(BaseContextMenu.Group, menuStyles.group, 'ContextMenu.Group'),
  GroupLabel: styledPart(
    BaseContextMenu.GroupLabel,
    menuStyles.groupLabel,
    'ContextMenu.GroupLabel',
  ),
  Item: styledPart(BaseContextMenu.Item, menuStyles.item, 'ContextMenu.Item'),
  LinkItem: styledPart(BaseContextMenu.LinkItem, menuStyles.item, 'ContextMenu.LinkItem'),
  CheckboxItem: styledPart(
    BaseContextMenu.CheckboxItem,
    menuStyles.item,
    'ContextMenu.CheckboxItem',
  ),
  CheckboxItemIndicator: styledPart(
    BaseContextMenu.CheckboxItemIndicator,
    menuStyles.itemIndicator,
    'ContextMenu.CheckboxItemIndicator',
  ),
  RadioGroup: styledPart(BaseContextMenu.RadioGroup, menuStyles.group, 'ContextMenu.RadioGroup'),
  RadioItem: styledPart(BaseContextMenu.RadioItem, menuStyles.item, 'ContextMenu.RadioItem'),
  RadioItemIndicator: styledPart(
    BaseContextMenu.RadioItemIndicator,
    menuStyles.itemIndicator,
    'ContextMenu.RadioItemIndicator',
  ),
  SubmenuRoot: BaseContextMenu.SubmenuRoot,
  SubmenuTrigger: styledPart(
    BaseContextMenu.SubmenuTrigger,
    menuStyles.item,
    'ContextMenu.SubmenuTrigger',
  ),
  Separator: styledPart(
    BaseContextMenu.Separator,
    disclosureStyles.separator,
    'ContextMenu.Separator',
  ),
} as const;

export type {
  ContextMenuArrowProps,
  ContextMenuArrowState,
  ContextMenuBackdropProps,
  ContextMenuBackdropState,
  ContextMenuCheckboxItemIndicatorProps,
  ContextMenuCheckboxItemIndicatorState,
  ContextMenuCheckboxItemProps,
  ContextMenuCheckboxItemState,
  ContextMenuGroupLabelProps,
  ContextMenuGroupLabelState,
  ContextMenuGroupProps,
  ContextMenuGroupState,
  ContextMenuItemProps,
  ContextMenuItemState,
  ContextMenuLinkItemProps,
  ContextMenuLinkItemState,
  ContextMenuPopupProps,
  ContextMenuPopupState,
  ContextMenuPortalProps,
  ContextMenuPortalState,
  ContextMenuPositionerProps,
  ContextMenuPositionerState,
  ContextMenuRadioGroupProps,
  ContextMenuRadioGroupState,
  ContextMenuRadioItemIndicatorProps,
  ContextMenuRadioItemIndicatorState,
  ContextMenuRadioItemProps,
  ContextMenuRadioItemState,
  ContextMenuRootChangeEventDetails,
  ContextMenuRootChangeEventReason,
  ContextMenuRootProps,
  ContextMenuRootState,
  ContextMenuSubmenuRootProps,
  ContextMenuSubmenuRootState,
  ContextMenuSubmenuTriggerProps,
  ContextMenuSubmenuTriggerState,
  ContextMenuTriggerProps,
  ContextMenuTriggerState,
} from '@base-ui/react/context-menu';
