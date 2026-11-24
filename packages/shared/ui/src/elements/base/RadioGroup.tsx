import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';

export type RadioGroupLabelProps = SlotProps<'span'>;

const RadioGroupRoot = styledPart(BaseRadioGroup, controlStyles.choiceGroup, 'RadioGroup.Root');
const RadioGroupLabel = createSlot('span', disclosureStyles.fieldLabel, 'RadioGroup.Label');

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Root: RadioGroupRoot,
  Label: RadioGroupLabel,
});

export type {
  RadioGroupChangeEventDetails,
  RadioGroupChangeEventReason,
  RadioGroupProps,
  RadioGroupState,
} from '@base-ui/react/radio-group';
