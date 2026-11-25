import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';

import { createSlot, cx, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';

export type CheckboxLabelProps = SlotProps<'label'>;

export const Checkbox = {
  Root: styledPart(
    BaseCheckbox.Root,
    cx(controlStyles.checkboxRoot, controlMobileStyles.touchHitArea),
    'Checkbox.Root',
  ),
  Indicator: styledPart(
    BaseCheckbox.Indicator,
    controlStyles.checkboxIndicator,
    'Checkbox.Indicator',
  ),
  Label: createSlot('label', controlStyles.choiceLabel, 'Checkbox.Label'),
} as const;

export type {
  CheckboxIndicatorProps,
  CheckboxIndicatorState,
  CheckboxRootChangeEventDetails,
  CheckboxRootChangeEventReason,
  CheckboxRootProps,
  CheckboxRootState,
} from '@base-ui/react/checkbox';
