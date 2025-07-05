import Box from '@mui/material-pigment-css/Box';
import IconButton from '@mui/material/IconButton';
import { css } from '@pigment-css/react';
import CloseMenuIcon from '../../icons/close_menu_icon.js';
import OpenMenuIcon from '../../icons/open_menu.js';

// const toggleMenuButtonStyle: SxProps<Theme> = {
// opacity: 0.2,
// '&:hover, &:focus': {
// opacity: 1,
// },
// };

interface ToggleMenuButtonProps {
  isToggledOpen: boolean;
  handleToggleContactMenu: () => void;
}

export default function ToggleMenuButton({ isToggledOpen, handleToggleContactMenu }: ToggleMenuButtonProps) {
  const icon = isToggledOpen ? <OpenMenuIcon /> : <CloseMenuIcon />;

  return (
    <Box sx={{ height: '100%' }}>
      <IconButton
        id='toggle-contact-menu'
        className={css({
          opacity: 0.2,
          '&:hover, &:focus': {
            opacity: 1,
          },
        })}
        tabIndex={0}
        onClick={handleToggleContactMenu}
        data-testid='toggle-contact-menu-button'
      >
        {icon}
      </IconButton>
    </Box>
  );
}
