import { NumberField as BaseNumberField } from '@base-ui/react/number-field';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';

export const NumberField = {
  Root: styledPart(BaseNumberField.Root, controlStyles.numberRoot, 'NumberField.Root'),
  Group: styledPart(BaseNumberField.Group, controlStyles.numberGroup, 'NumberField.Group'),
  Decrement: styledPart(
    BaseNumberField.Decrement,
    cx(controlStyles.numberStep, controlMobileStyles.touchTarget),
    'NumberField.Decrement',
  ),
  Input: styledPart(
    BaseNumberField.Input,
    cx(controlStyles.numberInput, controlMobileStyles.touchInput),
    'NumberField.Input',
  ),
  Increment: styledPart(
    BaseNumberField.Increment,
    cx(controlStyles.numberStep, controlMobileStyles.touchTarget),
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
