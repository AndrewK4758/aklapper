import Box from '@mui/material/Box';
import type { IconButtonProps } from '@mui/material/IconButton';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import CloseMenuIcon from '../../icons/close_menu_icon';
import OpenMenuIcon from '../../icons/open_menu';

interface ToggleMenuButtonProps extends Omit<IconButtonProps, 'id' | 'sx'> {
  isToggledOpen: boolean;
  handleToggleContactMenu: () => void;
}

export default function ToggleMenuButton({ isToggledOpen, handleToggleContactMenu, ...props }: ToggleMenuButtonProps) {
  const toggleMenuButtonStyle: SxProps<Theme> = {
    opacity: 0.2,
    '&:hover, &:focus': {
      opacity: 1,
    },
  };

  const icon = isToggledOpen ? <OpenMenuIcon /> : <CloseMenuIcon />;

  return (
    <Box height={'100%'}>
      <IconButton
        {...props}
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
