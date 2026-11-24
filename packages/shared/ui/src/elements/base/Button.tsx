import { Button as BaseButton, type ButtonProps as BaseButtonProps } from '@base-ui/react/button';
import { useRender } from '@base-ui/react/use-render';
import type { JSX } from 'react';

import { createSlot, cx, mergeBaseClassName, type SlotProps } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonRootProps extends BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export interface ButtonLinkProps extends useRender.ComponentProps<'a'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export type ButtonLabelProps = SlotProps<'span'>;
export type ButtonIconProps = SlotProps<'span'>;
export type ButtonSpinnerProps = SlotProps<'span'>;

export function ButtonRoot({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonRootProps): JSX.Element {
  return (
    <BaseButton
      {...props}
      disabled={disabled || loading}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? '' : undefined}
      className={mergeBaseClassName(controlStyles.button, className)}
    />
  );
}

ButtonRoot.displayName = 'Button.Root';

export function ButtonLink({
  render,
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps): JSX.Element {
  return useRender({
    defaultTagName: 'a',
    render,
    props: {
      ...props,
      'data-variant': variant,
      'data-size': size,
      className: cx(controlStyles.button, className),
    },
  });
}

ButtonLink.displayName = 'Button.Link';

const ButtonLabel = createSlot('span', controlStyles.buttonLabel, 'Button.Label');
const ButtonIcon = createSlot('span', controlStyles.buttonIcon, 'Button.Icon');
const ButtonSpinner = createSlot('span', controlStyles.buttonSpinner, 'Button.Spinner');

export const Button = Object.assign(ButtonRoot, {
  Root: ButtonRoot,
  Link: ButtonLink,
  Label: ButtonLabel,
  Icon: ButtonIcon,
  Spinner: ButtonSpinner,
});

export type { ButtonProps, ButtonState } from '@base-ui/react/button';
