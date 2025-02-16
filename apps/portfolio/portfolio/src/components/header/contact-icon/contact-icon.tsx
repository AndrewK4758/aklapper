import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import type { SxProps } from '@mui/material/styles';
import type { Dispatch, ReactElement, SetStateAction } from 'react';
import Box from '@mui/material/Box';
import { contactIconWrapperSxProps } from '../../../styles/header-styles.jsx';

interface ContactIconProps {
  id: string;
  tooltipText: string;
  iconHref: string;
  Icon: ReactElement;
  itemSx?: SxProps;
  tooltipSx?: SxProps;
  buttonSx?: SxProps;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: Dispatch<SetStateAction<any>>;
  stateVariable?: unknown;
}

export function ContactIcon({
  Icon,
  id,
  tooltipText,
  iconHref,
  itemSx,
  tooltipSx,
  buttonSx,
  onClick,
  stateVariable
}: ContactIconProps) {
  return (
    <Box
      component={`div`}
      key={`${id}-icon-wrapper`}
      id={`${id}-icon-wrapper`}
      data-testid={`${id}-icon-wrapper`}
      sx={contactIconWrapperSxProps}
    >
      <MenuItem
        component={`li`}
        disableTouchRipple={true}
        key={`${id}-icon-li`}
        id={`${id}-icon-li`}
        data-testid={`${id}-icon-li`}
        onClick={() => onClick?.call(onClick, stateVariable)}
        sx={itemSx}
      >
        <Tooltip
          placement="left-start"
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
            target="_blank"
            sx={buttonSx}
          >
            {Icon}
          </IconButton>
        </Tooltip>
      </MenuItem>
    </Box>
  );
}

export default ContactIcon;
