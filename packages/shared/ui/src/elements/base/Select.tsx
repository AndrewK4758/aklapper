import { Select as BaseSelect } from '@base-ui/react/select';

import { cx, styledPart, viewportStyledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';
import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const Select = {
  Root: BaseSelect.Root,
  Label: styledPart(BaseSelect.Label, disclosureStyles.fieldLabel, 'Select.Label'),
  Trigger: styledPart(BaseSelect.Trigger, menuStyles.trigger, 'Select.Trigger'),
  Value: styledPart(BaseSelect.Value, menuStyles.value, 'Select.Value'),
  Icon: styledPart(BaseSelect.Icon, menuStyles.icon, 'Select.Icon'),
  Portal: BaseSelect.Portal,
  Backdrop: viewportStyledPart(
    BaseSelect.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'Select.Backdrop',
  ),
  Positioner: viewportStyledPart(
    BaseSelect.Positioner,
    cx(menuStyles.positioner, overlayMobileStyles.sheetPositioner),
    'Select.Positioner',
  ),
  Popup: viewportStyledPart(
    BaseSelect.Popup,
    cx(menuStyles.popup, overlayMobileStyles.sheetPopup),
    'Select.Popup',
    { mobileSheet: true },
  ),
  List: styledPart(BaseSelect.List, menuStyles.list, 'Select.List'),
  Item: styledPart(BaseSelect.Item, menuStyles.item, 'Select.Item'),
  ItemIndicator: styledPart(
    BaseSelect.ItemIndicator,
    menuStyles.itemIndicator,
    'Select.ItemIndicator',
  ),
  ItemText: styledPart(BaseSelect.ItemText, menuStyles.itemText, 'Select.ItemText'),
  Arrow: viewportStyledPart(
    BaseSelect.Arrow,
    cx(overlayStyles.arrow, overlayMobileStyles.sheetArrow),
    'Select.Arrow',
  ),
  ScrollUpArrow: styledPart(
    BaseSelect.ScrollUpArrow,
    menuStyles.scrollArrow,
    'Select.ScrollUpArrow',
  ),
  ScrollDownArrow: styledPart(
    BaseSelect.ScrollDownArrow,
    menuStyles.scrollArrow,
    'Select.ScrollDownArrow',
  ),
  Group: styledPart(BaseSelect.Group, menuStyles.group, 'Select.Group'),
  GroupLabel: styledPart(BaseSelect.GroupLabel, menuStyles.groupLabel, 'Select.GroupLabel'),
  Separator: styledPart(BaseSelect.Separator, disclosureStyles.separator, 'Select.Separator'),
} as const;

export type {
  SelectArrowProps,
  SelectArrowState,
  SelectBackdropProps,
  SelectBackdropState,
  SelectGroupLabelProps,
  SelectGroupLabelState,
  SelectGroupProps,
  SelectGroupState,
  SelectIconProps,
  SelectIconState,
  SelectItemIndicatorProps,
  SelectItemIndicatorState,
  SelectItemProps,
  SelectItemState,
  SelectItemTextProps,
  SelectItemTextState,
  SelectLabelProps,
  SelectLabelState,
  SelectListProps,
  SelectListState,
  SelectPopupProps,
  SelectPopupState,
  SelectPortalProps,
  SelectPortalState,
  SelectPositionerProps,
  SelectPositionerState,
  SelectRootChangeEventDetails,
  SelectRootChangeEventReason,
  SelectRootProps,
  SelectRootState,
  SelectScrollDownArrowProps,
  SelectScrollDownArrowState,
  SelectScrollUpArrowProps,
  SelectScrollUpArrowState,
  SelectSeparatorProps,
  SelectTriggerProps,
  SelectTriggerState,
  SelectValueProps,
  SelectValueState,
} from '@base-ui/react/select';
