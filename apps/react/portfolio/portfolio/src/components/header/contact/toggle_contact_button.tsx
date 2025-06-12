import Box from '@mui/material/Box';
import type { IconButtonProps } from '@mui/material/IconButton';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import CloseMenuIcon from '../../icons/close_menu_icon';
import OpenMenuIcon from '../../icons/open_menu';

interface ToggleMenuButtonProps extends Omit<IconButtonProps, 'id' | 'sx'> {
  isToggledOpen: boolean;
  handleOpenContact: () => void;
}

export default function ToggleMenuButton({ isToggledOpen, handleOpenContact, ...props }: ToggleMenuButtonProps) {
  const toggleMenuButtonStyle: SxProps<Theme> = {
    opacity: 0.2,
    '&:hover': {
      opacity: 1,
    },
  };

  const icon = isToggledOpen ? (
    <OpenMenuIcon handleOpenContact={handleOpenContact} />
  ) : (
    <CloseMenuIcon handleOpenContact={handleOpenContact} />
  );

  return (
    <Box>
      <IconButton {...props} id='toggle-contact-menu' sx={toggleMenuButtonStyle}>
        {icon}
      </IconButton>
    </Box>
  );
}
