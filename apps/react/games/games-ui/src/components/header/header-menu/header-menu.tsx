import { Text } from '@aklapper/react-shared';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { SxProps } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export interface HeaderMenuProps {
  breakpointsMenu?: SxProps;
}

export function HeaderMenu({ breakpointsMenu }: HeaderMenuProps) {
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
      <Button
        LinkComponent={'nav'}
        role="button"
        color="inherit"
        size="large"
        disableRipple
        onClick={handleOpenMenu}
        startIcon={<MenuRoundedIcon htmlColor="inherit" sx={{ scale: 1.5 }} />}
        sx={{ paddingY: 0 }}
      >
        <Text component={'span'} titleVariant="button" titleText={'MENU'} sx={breakpointsMenu} />
      </Button>

      <Menu
        component={'ul'}
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        variant="menu"
        sx={{ textAlign: 'center' }}
      >
        <MenuItem divider={true} component="li" onClick={() => handleClick('/')}>
          {'HOME'}
        </MenuItem>
        <MenuItem divider={true} component="li" onClick={() => handleClick('/games')}>
          {'SHOW GAMES'}
        </MenuItem>
      </Menu>
    </>
  );
}

export default HeaderMenu;
