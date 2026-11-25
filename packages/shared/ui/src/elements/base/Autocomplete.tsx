import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete';

import { cx, styledPart, viewportStyledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';
import menuStyles from '../_styles/menu.module.css';
import overlayMobileStyles from '../_styles/overlay-mobile.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const Autocomplete = {
  Root: BaseAutocomplete.Root,
  Value: BaseAutocomplete.Value,
  Trigger: styledPart(BaseAutocomplete.Trigger, menuStyles.trigger, 'Autocomplete.Trigger'),
  Input: styledPart(BaseAutocomplete.Input, controlStyles.input, 'Autocomplete.Input'),
  InputGroup: styledPart(
    BaseAutocomplete.InputGroup,
    controlStyles.inputGroup,
    'Autocomplete.InputGroup',
  ),
  Icon: styledPart(BaseAutocomplete.Icon, menuStyles.icon, 'Autocomplete.Icon'),
  Clear: styledPart(BaseAutocomplete.Clear, menuStyles.clear, 'Autocomplete.Clear'),
  List: styledPart(BaseAutocomplete.List, menuStyles.list, 'Autocomplete.List'),
  Status: styledPart(BaseAutocomplete.Status, menuStyles.status, 'Autocomplete.Status'),
  Portal: BaseAutocomplete.Portal,
  Backdrop: viewportStyledPart(
    BaseAutocomplete.Backdrop,
    cx(overlayStyles.backdrop, overlayMobileStyles.sheetBackdrop),
    'Autocomplete.Backdrop',
  ),
  Positioner: viewportStyledPart(
    BaseAutocomplete.Positioner,
    cx(menuStyles.positioner, overlayMobileStyles.sheetPositioner),
    'Autocomplete.Positioner',
  ),
  Popup: viewportStyledPart(
    BaseAutocomplete.Popup,
    cx(menuStyles.popup, overlayMobileStyles.sheetPopup),
    'Autocomplete.Popup',
    { mobileSheet: true },
  ),
  Arrow: viewportStyledPart(
    BaseAutocomplete.Arrow,
    cx(overlayStyles.arrow, overlayMobileStyles.sheetArrow),
    'Autocomplete.Arrow',
  ),
  Group: styledPart(BaseAutocomplete.Group, menuStyles.group, 'Autocomplete.Group'),
  GroupLabel: styledPart(
    BaseAutocomplete.GroupLabel,
    menuStyles.groupLabel,
    'Autocomplete.GroupLabel',
  ),
  Item: styledPart(BaseAutocomplete.Item, menuStyles.item, 'Autocomplete.Item'),
  Row: styledPart(BaseAutocomplete.Row, menuStyles.row, 'Autocomplete.Row'),
  Collection: BaseAutocomplete.Collection,
  Empty: styledPart(BaseAutocomplete.Empty, menuStyles.empty, 'Autocomplete.Empty'),
  Separator: styledPart(
    BaseAutocomplete.Separator,
    disclosureStyles.separator,
    'Autocomplete.Separator',
  ),
  useFilter: BaseAutocomplete.useFilter,
  useFilteredItems: BaseAutocomplete.useFilteredItems,
} as const;

export type {
  AutocompleteArrowProps,
  AutocompleteArrowState,
  AutocompleteBackdropProps,
  AutocompleteBackdropState,
  AutocompleteClearProps,
  AutocompleteClearState,
  AutocompleteCollectionProps,
  AutocompleteEmptyProps,
  AutocompleteEmptyState,
  AutocompleteGroupLabelProps,
  AutocompleteGroupLabelState,
  AutocompleteGroupProps,
  AutocompleteGroupState,
  AutocompleteIconProps,
  AutocompleteIconState,
  AutocompleteInputGroupProps,
  AutocompleteInputGroupState,
  AutocompleteInputProps,
  AutocompleteInputState,
  AutocompleteItemProps,
  AutocompleteItemState,
  AutocompleteListProps,
  AutocompleteListState,
  AutocompletePopupProps,
  AutocompletePopupState,
  AutocompletePortalProps,
  AutocompletePortalState,
  AutocompletePositionerProps,
  AutocompletePositionerState,
  AutocompleteRootChangeEventDetails,
  AutocompleteRootChangeEventReason,
  AutocompleteRootProps,
  AutocompleteRootState,
  AutocompleteRowProps,
  AutocompleteRowState,
  AutocompleteSeparatorProps,
  AutocompleteStatusProps,
  AutocompleteStatusState,
  AutocompleteTriggerProps,
  AutocompleteTriggerState,
  AutocompleteValueProps,
} from '@base-ui/react/autocomplete';
