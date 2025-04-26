import { Text } from '@aklapper/react-shared';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import type { SxProps } from '@mui/material';
import ButtonBase from '@mui/material/ButtonBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useContext, useRef, useState } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../../context/active-player-context';
import { __errorLight, __errorMain, __greyDark, __infoDark, __infoLight } from '../../../styles/colors';
import { GamesTheme } from '../../../styles/games-theme';

export function HeaderMenu() {
  const { activePlayer, deleteActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const { pathname } = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuItemTextRef = useRef<HTMLSpanElement[]>([]);
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
      <ButtonBase
        LinkComponent={'button'}
        component={'button'}
        aria-label='open nav menu'
        role='button'
        color='inherit'
        disableRipple
        onClick={handleOpenMenu}
        sx={{ flex: '0 1 86px' }}
        onFocus={e => {
          e.currentTarget.style.color = GamesTheme.palette.warning.main;
        }}
        onBlur={e => {
          e.currentTarget.style.color = 'inherit';
        }}
      >
        <MenuRoundedIcon component={'svg'} color='inherit' sx={{ scale: 2.5 }} />
      </ButtonBase>

      <Menu
        component={'ul'}
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        variant='menu'
        slotProps={{
          paper: {
            sx: {
              backgroundColor: __greyDark,
            },
          },
        }}
        sx={{ textAlign: 'center' }}
      >
        {pathname !== '/lobby' && (
          <MenuItem
            divider={true}
            component='li'
            onClick={() => handleClick('/')}
            sx={{ fontSize: '3rem' }}
            onMouseEnter={() => {
              if (menuItemTextRef.current) menuItemTextRef.current[0].style.color = __infoLight;
            }}
            onMouseLeave={() => {
              if (menuItemTextRef.current) menuItemTextRef.current[0].style.color = __infoDark;
            }}
          >
            <Text
              titleVariant='h4'
              component={'h4'}
              titleText={'HOME'}
              TypogrpahyProps={{
                ref: e => {
                  if (e) menuItemTextRef.current[0] = e;
                },
              }}
            />
          </MenuItem>
        )}
        <MenuItem
          divider={true}
          component='li'
          onClick={() => handleClick('/lobby')}
          sx={{ fontSize: '3rem' }}
          onMouseEnter={() => {
            if (menuItemTextRef.current) menuItemTextRef.current[1].style.color = __infoLight;
          }}
          onMouseLeave={() => {
            if (menuItemTextRef.current) menuItemTextRef.current[1].style.color = __infoDark;
          }}
        >
          <Text
            titleVariant='h4'
            component={'h4'}
            titleText={'LOBBY'}
            TypogrpahyProps={{
              ref: e => {
                if (e) menuItemTextRef.current[1] = e;
              },
            }}
          />
        </MenuItem>
        {activePlayer.name && (
          <MenuItem
            divider={true}
            component={'li'}
            onMouseEnter={() => {
              if (menuItemTextRef.current) menuItemTextRef.current[2].style.color = __errorLight;
            }}
            onMouseLeave={() => {
              if (menuItemTextRef.current) menuItemTextRef.current[2].style.color = __errorMain;
            }}
          >
            <Text
              id='logout-player'
              titleVariant='h4'
              component={'h4'}
              titleText={'Logout'}
              TypogrpahyProps={{
                ref: e => {
                  if (e) menuItemTextRef.current[2] = e;
                },
                color: 'error',
                onClick: () => handleLogoutPlayer(deleteActivePlayer, nav),
              }}
              sx={registerPlayerFormSxProps}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export default HeaderMenu;

const registerPlayerFormSxProps: SxProps = {
  width: '100%',
  background: 'transparant',
};

function handleLogoutPlayer(deleteActivePlayer: () => void, nav: NavigateFunction) {
  deleteActivePlayer();
  nav('/');
}
