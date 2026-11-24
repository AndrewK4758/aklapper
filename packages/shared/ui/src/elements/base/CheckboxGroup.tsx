import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';

export type CheckboxGroupLabelProps = SlotProps<'span'>;

const CheckboxGroupRoot = styledPart(
  BaseCheckboxGroup,
  controlStyles.choiceGroup,
  'CheckboxGroup.Root',
);
const CheckboxGroupLabel = createSlot('span', disclosureStyles.fieldLabel, 'CheckboxGroup.Label');

export const CheckboxGroup = Object.assign(CheckboxGroupRoot, {
  Root: CheckboxGroupRoot,
  Label: CheckboxGroupLabel,
});

export type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupChangeEventReason,
  CheckboxGroupProps,
  CheckboxGroupState,
} from '@base-ui/react/checkbox-group';
