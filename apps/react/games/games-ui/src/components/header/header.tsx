import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { useContext } from 'react';
import { type Location, useLocation } from 'react-router';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { headerToolbarSx } from '../../styles/header-styles';
import HeaderAvatar from './avatar/avatar';
import HeaderMenu from './header-menu/header-menu';
import SelectTitle from './title/select-title';

const Header = () => {
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const { pathname }: Location = useLocation();

  return (
    <AppBar position='sticky' component={'header'} enableColorOnDark>
      <Toolbar variant='dense' sx={headerToolbarSx}>
        <HeaderMenu />
        <SelectTitle pathname={pathname} />
        {activePlayer.name && <HeaderAvatar activePlayer={activePlayer} />}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
