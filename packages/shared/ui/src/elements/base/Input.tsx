import { Input as BaseInput, type InputProps as BaseInputProps } from '@base-ui/react/input';
import type { JSX } from 'react';

import { createSlot, mergeBaseClassName, type SlotProps } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputRootProps extends Omit<BaseInputProps, 'size'> {
  inputSize?: InputSize;
  htmlSize?: BaseInputProps['size'];
}

export type InputGroupProps = SlotProps<'div'>;
export type InputPrefixProps = SlotProps<'span'>;
export type InputSuffixProps = SlotProps<'span'>;

export function InputRoot({
  inputSize = 'md',
  htmlSize,
  className,
  ...props
}: InputRootProps): JSX.Element {
  return (
    <BaseInput
      {...props}
      size={htmlSize}
      data-size={inputSize}
      className={mergeBaseClassName(controlStyles.input, className)}
    />
  );
}

InputRoot.displayName = 'Input.Root';

const InputGroup = createSlot('div', controlStyles.inputGroup, 'Input.Group');
const InputPrefix = createSlot('span', controlStyles.inputAffix, 'Input.Prefix');
const InputSuffix = createSlot('span', controlStyles.inputAffix, 'Input.Suffix');

export const Input = Object.assign(InputRoot, {
  Root: InputRoot,
  Group: InputGroup,
  Prefix: InputPrefix,
  Suffix: InputSuffix,
});

export type {
  InputChangeEventDetails,
  InputChangeEventReason,
  InputProps,
  InputState,
} from '@base-ui/react/input';
