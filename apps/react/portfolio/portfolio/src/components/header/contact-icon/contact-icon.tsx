// import Box from '@mui/material/Box';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
// import MenuItem from '@mui/material/MenuItem';
import type { SxProps } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import type { ReactElement } from 'react';
// import { contactIconWrapperSxProps } from '../../../styles/header-styles.jsx';

interface ContactIconProps {
  id: string;
  tooltipText: string;
  iconHref: string;
  Icon: ReactElement;
  itemSx?: SxProps;
  tooltipSx?: SxProps;
  buttonSx?: SxProps;
  onClick?: () => void;
}

export function ContactIcon({
  Icon,
  id,
  tooltipText,
  iconHref,
  // itemSx,
  tooltipSx,
  buttonSx,
  onClick,
}: ContactIconProps) {
  return (
    <Box component={`div`} key={`${id}-icon-wrapper`} id={`${id}-icon-wrapper`} data-testid={`${id}-icon-wrapper`}>
      {/* <MenuItem
    //   component={`li`}
    //   disableTouchRipple={true}
    //   key={`${id}-icon-li`}
    //   id={`${id}-icon-li`}
    //   data-testid={`${id}-icon-li`}
    //   onClick={onClick}
    //   sx={itemSx}
    // >*/}
      <Tooltip
        placement='left-start'
        key={`${id}-icon-tooltip`}
        id={`${id}-icon-tooltip`}
        data-testid={`${id}-icon-tooltip`}
        title={`${tooltipText}`}
        slotProps={{ tooltip: { sx: tooltipSx } }}
      >
        <IconButton
          key={`${id}-icon`}
          disableFocusRipple
          id={`${id}-icon`}
          data-testid={`${id}-icon`}
          href={iconHref}
          target='_blank'
          sx={buttonSx}
          onClick={onClick}
        >
          {Icon}
        </IconButton>
      </Tooltip>
      {/* // </MenuItem> */}
    </Box>
  );
}

export default ContactIcon;
