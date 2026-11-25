import { Input as BaseInput, type InputProps as BaseInputProps } from '@base-ui/react/input';
import type { JSX } from 'react';

import {
  type ElementViewMode,
  resolveElementViewport,
} from '../../components/terminalViewportSplit';
import { useViewportContext } from '../../components/ViewportProvider';
import { createSlot, cx, mergeBaseClassName, type SlotProps } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputRootProps extends Omit<BaseInputProps, 'size'> {
  inputSize?: InputSize;
  htmlSize?: BaseInputProps['size'];
  readonly viewMode?: ElementViewMode;
}

export type InputGroupProps = SlotProps<'div'>;
export type InputPrefixProps = SlotProps<'span'>;
export type InputSuffixProps = SlotProps<'span'>;

export function InputRoot({
  inputSize = 'md',
  htmlSize,
  viewMode,
  className,
  ...props
}: InputRootProps): JSX.Element {
  const { layoutMode } = useViewportContext();
  const resolvedViewport = viewMode ? resolveElementViewport(layoutMode, viewMode) : undefined;
  return (
    <BaseInput
      {...props}
      size={htmlSize}
      data-size={inputSize}
      data-viewport={resolvedViewport}
      className={mergeBaseClassName(
        cx(controlStyles.input, controlMobileStyles.touchInput),
        className,
      )}
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
