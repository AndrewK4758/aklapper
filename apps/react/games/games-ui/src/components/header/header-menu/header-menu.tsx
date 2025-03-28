import { Text } from '@aklapper/react-shared';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { SxProps } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export interface HeaderMenuProps {
  breakpointsMenu?: SxProps;
  breakpointsMenuItem?: SxProps;
}

export function HeaderMenu({ breakpointsMenu, breakpointsMenuItem }: HeaderMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const nav = useNavigate();

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => setAnchorEl(null);

  const handleClick = (path: string) => {
    nav(path);
    handleCloseMenu();
  };
  return (
    <>
      <IconButton size="large" onClick={handleOpenMenu} edge={false} sx={{ padding: 0 }}>
        <MenuRoundedIcon color={'success'} fontSize="large" />
        <Text component={'h2'} titleVariant="h2" titleText={'MENU'} sx={breakpointsMenu} />
      </IconButton>

      <Menu
        component={'ul'}
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        variant="menu"
        sx={{ textAlign: 'center' }}
      >
        <MenuItem divider={true} component="button" onClick={() => handleClick('/')} sx={breakpointsMenuItem}>
          {'HOME'}
        </MenuItem>
        <MenuItem divider={true} component="button" onClick={() => handleClick('/games')} sx={breakpointsMenuItem}>
          {'SHOW GAMES'}
        </MenuItem>
      </Menu>
    </>
  );
}

export default HeaderMenu;
