import Box from '@mui/material/Box';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import CloseMenuIcon from '../../icons/close_menu_icon';
import OpenMenuIcon from '../../icons/open_menu';

interface ToggleMenuButtonProps extends IconButtonProps {
  isToggledOpen: boolean;
  handleToggleContactMenu: () => void;
}

export default function ToggleMenuButton({ isToggledOpen, handleToggleContactMenu, ...props }: ToggleMenuButtonProps) {
  const icon = isToggledOpen ? <OpenMenuIcon /> : <CloseMenuIcon />;

  return (
    <Box sx={{ height: '100%' }}>
      <IconButton
        {...props}
        id='toggle-contact-menu'
        sx={{
          opacity: 0.2,
          '&:hover, &:focus': {
            opacity: 1,
          },
        }}
        tabIndex={0}
        onClick={handleToggleContactMenu}
        data-testid='toggle-contact-menu-button'
      >
        {icon}
      </IconButton>
    </Box>
  );
}
