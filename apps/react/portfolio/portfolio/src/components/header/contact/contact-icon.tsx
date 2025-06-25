import IconButton from '@mui/material/IconButton';
// import Tooltip from '@mui/material/Tooltip';
import type { ReactElement } from 'react';
import AnimatedBorderBox from '../../styled/animated_border_box.js';

interface ContactIconProps {
  generalId: string;
  borderClassName?: string;
  // tooltipTitle: string;
  iconHref?: string;
  Icon?: ReactElement;
  variant?: 'socialMediaLink';
  onClick?: () => void;
}

export function ContactIcon({ Icon, generalId, iconHref, onClick }: ContactIconProps) {
  const isLink = !!iconHref;

  const conditionalIconButtonProps = isLink
    ? {
        href: iconHref,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {
        onClick: onClick,
      };

  return (
    <AnimatedBorderBox component={`div`} id={`${generalId}-wrapper`} data-testid={`${generalId}-icon-wrapper`}>
      {/* <Tooltip title={tooltipTitle} placement='bottom' data-testid={`${generalId}-icon-tooltip`}> */}
      <IconButton
        LinkComponent={'a'}
        disableFocusRipple
        id={`${generalId}-icon`}
        data-testid={`${generalId}-icon`}
        {...conditionalIconButtonProps}
        sx={{ pointerEvents: 'none' }}
      >
        {Icon}
      </IconButton>
      {/* </Tooltip> */}
    </AnimatedBorderBox>
  );
}

export default ContactIcon;
