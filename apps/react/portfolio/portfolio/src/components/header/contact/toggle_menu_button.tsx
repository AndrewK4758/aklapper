import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import CloseMenuIcon from '../../icons/close_menu_icon.js';
import OpenMenuIcon from '../../icons/open_menu.js';

const toggleMenuButtonStyle: SxProps<Theme> = {
  opacity: 0.2,
  '&:hover, &:focus': {
    opacity: 1,
  },
};

interface ToggleMenuButtonProps {
  isToggledOpen: boolean;
  handleToggleContactMenu: () => void;
}

export default function ToggleMenuButton({ isToggledOpen, handleToggleContactMenu }: ToggleMenuButtonProps) {
  const icon = isToggledOpen ? <OpenMenuIcon /> : <CloseMenuIcon />;

  return (
    <Box height={'100%'}>
      <IconButton
        suppressHydrationWarning
        id='toggle-contact-menu'
        tabIndex={0}
        onClick={handleToggleContactMenu}
        sx={toggleMenuButtonStyle}
      >
        {icon}
      </IconButton>
    </Box>
  );
}
