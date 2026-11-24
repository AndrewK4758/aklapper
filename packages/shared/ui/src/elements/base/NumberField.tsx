import { NumberField as BaseNumberField } from '@base-ui/react/number-field';

import { styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

export const NumberField = {
  Root: styledPart(BaseNumberField.Root, controlStyles.numberRoot, 'NumberField.Root'),
  Group: styledPart(BaseNumberField.Group, controlStyles.numberGroup, 'NumberField.Group'),
  Decrement: styledPart(
    BaseNumberField.Decrement,
    controlStyles.numberStep,
    'NumberField.Decrement',
  ),
  Input: styledPart(BaseNumberField.Input, controlStyles.numberInput, 'NumberField.Input'),
  Increment: styledPart(
    BaseNumberField.Increment,
    controlStyles.numberStep,
    'NumberField.Increment',
  ),
  ScrubArea: styledPart(
    BaseNumberField.ScrubArea,
    controlStyles.numberScrubArea,
    'NumberField.ScrubArea',
  ),
  ScrubAreaCursor: styledPart(
    BaseNumberField.ScrubAreaCursor,
    controlStyles.numberScrubCursor,
    'NumberField.ScrubAreaCursor',
  ),
} as const;

export type {
  NumberFieldDecrementProps,
  NumberFieldDecrementState,
  NumberFieldGroupProps,
  NumberFieldGroupState,
  NumberFieldIncrementProps,
  NumberFieldIncrementState,
  NumberFieldInputProps,
  NumberFieldInputState,
  NumberFieldRootChangeEventDetails,
  NumberFieldRootChangeEventReason,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootCommitEventReason,
  NumberFieldRootProps,
  NumberFieldRootState,
  NumberFieldScrubAreaCursorProps,
  NumberFieldScrubAreaCursorState,
  NumberFieldScrubAreaProps,
  NumberFieldScrubAreaState,
} from '@base-ui/react/number-field';
