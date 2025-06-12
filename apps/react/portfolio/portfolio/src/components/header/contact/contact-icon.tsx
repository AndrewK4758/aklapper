import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import { type TooltipProps } from '@mui/material/Tooltip';
import type { ReactElement } from 'react';
import AnimatedBorderBox from '../../styled/animated_border_box.js';
import StyledIconTooltip from '../../styled/tooltip.js';

interface ContactIconProps {
  generalId: string;
  borderClassName?: string;
  tooltipTitle: string;
  IconButtonProps?: IconButtonProps;
  TooltipProps?: Omit<TooltipProps, 'title' | 'placement'>;
  iconHref?: string;
  Icon?: ReactElement;
  variant?: 'socialMediaLink';
  onClick?: () => void;
}

export function ContactIcon({
  Icon,
  generalId,
  tooltipTitle,
  iconHref,
  onClick,
  IconButtonProps,
  TooltipProps,
}: ContactIconProps) {
  const isLink = !!iconHref;

  const conditionalIconButtonProps = isLink
    ? {
        component: 'a',
        href: iconHref,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {
        component: 'button',
        onClick: onClick,
      };

  return (
    <AnimatedBorderBox component={`div`} id={`${generalId}-wrapper`} data-testid={`${generalId}-icon-wrapper`}>
      <StyledIconTooltip
        {...TooltipProps}
        title={tooltipTitle}
        placement='bottom'
        data-testid={`${generalId}-icon-tooltip`}
      >
        <IconButton
          {...IconButtonProps}
          {...conditionalIconButtonProps}
          disableFocusRipple
          id={`${generalId}-icon`}
          data-testid={`${generalId}-icon`}
        >
          {Icon}
        </IconButton>
      </StyledIconTooltip>
    </AnimatedBorderBox>
  );
}

export default ContactIcon;
