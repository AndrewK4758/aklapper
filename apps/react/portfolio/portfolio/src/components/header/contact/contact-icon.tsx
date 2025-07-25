import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import { type ReactNode } from 'react';
import AnimatedBorderBox from '../../styled/animated_border_box';

interface ContactIconProps extends IconButtonProps {
  generalId: string;
  iconHref?: string;
  children: ReactNode;
  onClick?: () => void;
}

export default function ContactIcon({ generalId, iconHref, onClick, children }: ContactIconProps) {
  const isLink = !!iconHref;

  const conditionalIconButtonProps = isLink
    ? {
        href: iconHref,
        target: '_blank',
        rel: 'noopener noreferrer',
        role: 'link',
      }
    : {
        onClick: onClick,
        role: 'button',
      };

  const buttonElement = (
    <IconButton
      disableRipple
      id={`${generalId}-icon`}
      data-testid={`${generalId}-icon`}
      {...conditionalIconButtonProps}
    >
      {children}
    </IconButton>
  );

  return (
    <AnimatedBorderBox component={`div`} id={`${generalId}-wrapper`} data-testid={`${generalId}-icon-wrapper`}>
      {buttonElement}
    </AnimatedBorderBox>
  );
}
