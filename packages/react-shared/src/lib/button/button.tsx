import { Button, ButtonState, ComponentRenderFn, HTMLProps } from '@base-ui/react';
import { ButtonHTMLAttributes, forwardRef, ReactElement, ReactNode } from 'react';
import useAriaPressed from '../hooks/use_aria_pressed';
import { mergeEventHandlers } from '../utils/merge_handlers';
import styles from '../styles/button/button.module.css';
import mergeCssClasses from '../utils/merge_css_classes';

export interface MyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  controls?: string;
  renderAs?: ReactElement | ComponentRenderFn<HTMLProps, ButtonState> | undefined;
  loading?: boolean;
}

const ButtonBase = forwardRef<HTMLButtonElement, MyButtonProps>(function (
  { children, controls, renderAs, loading, ...props }: MyButtonProps,
  ref,
) {
  const { isPressed, isExpanded, pressHandlers, isFocused, toggleExpanded } = useAriaPressed();

  const onMouseDown = mergeEventHandlers(pressHandlers.onMouseDown, props.onMouseDown);
  const onMouseUp = mergeEventHandlers(pressHandlers.onMouseUp, props.onMouseUp);
  const onMouseLeave = mergeEventHandlers(pressHandlers.onMouseLeave, props.onMouseLeave);
  const onClick = mergeEventHandlers(toggleExpanded, props.onClick);
  const onFocus = mergeEventHandlers(pressHandlers.onFocus, props.onFocus);
  const onBlur = mergeEventHandlers(pressHandlers.onBlur, props.onBlur);
  const finalClass = mergeCssClasses(props.className, styles.buttonRoot);

  return (
    <Button
      ref={ref}
      {...props}
      tabIndex={0}
      className={finalClass}
      focusableWhenDisabled={false}
      render={renderAs}
      role={'button'}
      aria-pressed={isPressed}
      aria-expanded={isExpanded}
      aria-disabled={props.disabled || loading}
      aria-controls={controls}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      data-focus={isFocused && !isPressed ? 'true' : undefined}
      data-disabled={props.disabled}
    >
      {children}
    </Button>
  );
});

export interface ButtonLabelProps extends ButtonHTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  required?: boolean;
}

function ButtonLabel({ children, required, ...props }: ButtonLabelProps) {
  const finalClass = mergeCssClasses(props.className, styles.label);

  return (
    <span {...props} className={finalClass} data-required={required}>
      {children}
    </span>
  );
}

export interface ButtonIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconPosition?: 'start' | 'end';
}

function ButtonIcon({ iconPosition, children, className, ...props }: ButtonIconProps) {
  const iconPositionClass = iconPosition === 'start' ? styles.iconStart : styles.iconEnd;

  const finalClass = mergeCssClasses(className, iconPositionClass);

  return (
    <span {...props} className={finalClass}>
      {children}
    </span>
  );
}

ButtonBase.displayName = 'Button';
ButtonLabel.displayName = 'Button.Label';
ButtonIcon.displayName = 'Button.Icon';

export const MyButton = Object.assign(ButtonBase, { Label: ButtonLabel, Icon: ButtonIcon });

// export default MyButton;
