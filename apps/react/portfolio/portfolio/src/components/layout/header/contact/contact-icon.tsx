import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import type { TooltipProps } from '@mui/material/Tooltip';
import Tooltip from '@mui/material/Tooltip';
import { type ReactNode } from 'react';
import AnimatedBorderBox from '../../../styled/animated_border_box.js';

interface ContactIconProps extends IconButtonProps {
  generalId: string;
  iconHref?: string;
  children: ReactNode;
  tooltip?: Omit<TooltipProps, 'children'>;
  onClick?: () => void;
}

export default function ContactIcon({ generalId, iconHref, onClick, children, tooltip }: ContactIconProps) {
  const isLink = !!iconHref;
  const hasTooltip = !!tooltip;

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

  const buttonElement = hasTooltip ? (
    <Tooltip {...tooltip}>
      <IconButton
        disableRipple
        id={`${generalId}-icon`}
        data-testid={`${generalId}-icon`}
        {...conditionalIconButtonProps}
      >
        {children}
      </IconButton>
    </Tooltip>
  ) : (
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
