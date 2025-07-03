import { Text } from '@aklapper/react-shared';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import type { SxProps } from '@mui/material';
import ButtonBase from '@mui/material/ButtonBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useContext, useRef, useState } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../../context/active-player-context';
import { MessageContext, type MessagesContextProps } from '../../../context/messages_context';
import { __errorLight, __errorMain, __greyDark, __infoDark, __infoLight } from '../../../styles/colors';
import { GamesTheme } from '../../../styles/games-theme';

export function HeaderMenu() {
  const { activePlayer, deleteActivePlayer, addActivePlayer } =
    useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const { clearSavedMessages } = useContext<MessagesContextProps>(MessageContext);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuItemTextRef = useRef<HTMLSpanElement[]>([]);
  const { pathname } = useLocation();

  const open = Boolean(anchorEl);

  const nav = useNavigate();

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => setAnchorEl(null);

  const handleClick = (path: string) => {
    switch (path) {
      case '/':
        addActivePlayer({ ...activePlayer, activeGameID: null, socketIoId: null, inLobby: false });
        nav(path);
        handleCloseMenu();
        break;
      case '/lobby':
        addActivePlayer({ ...activePlayer, inLobby: true });
        nav(path);
        handleCloseMenu();
        break;
    }
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
        <MenuItem
          divider={true}
          component='li'
          onClick={() => handleClick('/')}
          onMouseEnter={() => {
            if (menuItemTextRef.current) menuItemTextRef.current[0].style.color = __infoLight;
          }}
          onMouseLeave={() => {
            if (menuItemTextRef.current) menuItemTextRef.current[0].style.color = __infoDark;
          }}
        >
          <Text
            ref={e => {
              if (e) menuItemTextRef.current[0] = e;
            }}
            variant='h4'
            children={'HOME'}
          />
        </MenuItem>

        {pathname !== '/lobby' && (
          <MenuItem
            divider={true}
            component='li'
            onClick={() => handleClick('/lobby')}
            onMouseEnter={() => {
              if (menuItemTextRef.current) menuItemTextRef.current[1].style.color = __infoLight;
            }}
            onMouseLeave={() => {
              if (menuItemTextRef.current) menuItemTextRef.current[1].style.color = __infoDark;
            }}
          >
            <Text
              ref={e => {
                if (e) menuItemTextRef.current[1] = e;
              }}
              variant='h4'
              component={'h4'}
              children={'LOBBY'}
            />
          </MenuItem>
        )}
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
              ref={e => {
                if (e) menuItemTextRef.current[1] = e;
              }}
              id='logout-player'
              variant='h4'
              component={'h4'}
              children={'Logout'}
              color='error'
              onClick={() => handleLogoutPlayer(deleteActivePlayer, nav, clearSavedMessages)}
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

function handleLogoutPlayer(deleteActivePlayer: () => void, nav: NavigateFunction, clearSavedMessages: () => void) {
  deleteActivePlayer();
  clearSavedMessages();
  sessionStorage.removeItem('joined-game');
  nav('/');
}
