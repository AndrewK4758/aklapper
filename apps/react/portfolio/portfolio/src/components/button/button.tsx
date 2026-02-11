import { type ButtonIconProps, type ButtonLabelProps, MyButton, type MyButtonProps } from '@aklapper/react-shared';
import { type ReactNode, type RefObject } from 'react';
import buttonStyles from '@styles/components/button/button.module.css';

interface AppButtonProps {
  RootProps?: MyButtonProps;
  LabelProps?: ButtonLabelProps;
  IconProps?: ButtonIconProps;
  label: ReactNode;
  icon?: ReactNode;
  ref?: RefObject<HTMLButtonElement>;
}

export default function AppButton({
  label,
  icon,
  ref,
  IconProps = {},
  LabelProps = {},
  RootProps = {},
}: AppButtonProps) {
  return (
    <MyButton
      ref={ref}
      className={buttonStyles.appComponentStyles}
      {...RootProps}
      renderAs={RootProps.renderAs}
      loading={RootProps.loading}
    >
      <MyButton.Label {...LabelProps} data-required={LabelProps.required} className={buttonStyles.buttonLabel}>
        {label}
      </MyButton.Label>
      <MyButton.Icon {...IconProps} className={buttonStyles.buttonIcon}>
        {icon}
      </MyButton.Icon>
    </MyButton>
  );
}
 