import { Button as BaseButton, type ButtonProps as BaseButtonProps } from '@base-ui/react/button';
import { useRender } from '@base-ui/react/use-render';
import type { JSX } from 'react';

import {
  type ElementViewMode,
  resolveElementViewport,
} from '../../components/terminalViewportSplit';
import { useViewportContext } from '../../components/ViewportProvider';
import { createSlot, cx, mergeBaseClassName, type SlotProps } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonRootProps extends BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  readonly viewMode?: ElementViewMode;
}

export interface ButtonLinkProps extends useRender.ComponentProps<'a'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  readonly viewMode?: ElementViewMode;
}

export type ButtonLabelProps = SlotProps<'span'>;
export type ButtonIconProps = SlotProps<'span'>;
export type ButtonSpinnerProps = SlotProps<'span'>;

export function ButtonRoot({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  viewMode,
  className,
  ...props
}: ButtonRootProps): JSX.Element {
  const { layoutMode } = useViewportContext();
  const resolvedViewport = viewMode ? resolveElementViewport(layoutMode, viewMode) : undefined;
  return (
    <BaseButton
      {...props}
      disabled={disabled || loading}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? '' : undefined}
      {...(resolvedViewport !== undefined ? { 'data-viewport': resolvedViewport } : {})}
      className={mergeBaseClassName(
        cx(controlStyles.button, controlMobileStyles.touchTarget),
        className,
      )}
    />
  );
}

ButtonRoot.displayName = 'Button.Root';

export function ButtonLink({
  render,
  variant = 'default',
  size = 'md',
  viewMode,
  className,
  ...props
}: ButtonLinkProps): JSX.Element {
  const { layoutMode } = useViewportContext();
  const resolvedViewport = viewMode ? resolveElementViewport(layoutMode, viewMode) : undefined;
  return useRender({
    defaultTagName: 'a',
    render,
    props: {
      ...props,
      'data-variant': variant,
      'data-size': size,
      ...(resolvedViewport ? { 'data-viewport': resolvedViewport } : {}),
      className: cx(controlStyles.button, controlMobileStyles.touchTarget, className),
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
