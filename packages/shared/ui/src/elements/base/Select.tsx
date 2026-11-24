import { Select as BaseSelect } from '@base-ui/react/select';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const Select = {
  Root: BaseSelect.Root,
  Label: styledPart(BaseSelect.Label, disclosureStyles.fieldLabel, 'Select.Label'),
  Trigger: styledPart(BaseSelect.Trigger, menuStyles.trigger, 'Select.Trigger'),
  Value: styledPart(BaseSelect.Value, menuStyles.value, 'Select.Value'),
  Icon: styledPart(BaseSelect.Icon, menuStyles.icon, 'Select.Icon'),
  Portal: BaseSelect.Portal,
  Backdrop: styledPart(BaseSelect.Backdrop, overlayStyles.backdrop, 'Select.Backdrop'),
  Positioner: styledPart(BaseSelect.Positioner, menuStyles.positioner, 'Select.Positioner'),
  Popup: styledPart(BaseSelect.Popup, menuStyles.popup, 'Select.Popup'),
  List: styledPart(BaseSelect.List, menuStyles.list, 'Select.List'),
  Item: styledPart(BaseSelect.Item, menuStyles.item, 'Select.Item'),
  ItemIndicator: styledPart(
    BaseSelect.ItemIndicator,
    menuStyles.itemIndicator,
    'Select.ItemIndicator',
  ),
  ItemText: styledPart(BaseSelect.ItemText, menuStyles.itemText, 'Select.ItemText'),
  Arrow: styledPart(BaseSelect.Arrow, overlayStyles.arrow, 'Select.Arrow'),
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
