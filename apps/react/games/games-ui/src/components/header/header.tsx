import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import { SxProps } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import { type ElementType, useContext } from 'react';
import ActivePlayerContext, { ActivePlayerContextProps } from '../../context/active-player-context';
import HeaderMenu from './header-menu/header-menu';

export interface HeaderProps {
  componentAppBar: ElementType;
  sxAppBar?: SxProps;
}

export const Header = ({ componentAppBar, sxAppBar }: HeaderProps) => {
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  return (
    <AppBar elevation={0} component={componentAppBar} color='primary' enableColorOnDark sx={sxAppBar}>
      <Toolbar variant='dense' sx={{ justifyContent: 'space-between' }}>
        <HeaderMenu />
        {activePlayer.Name && <Avatar sx={{ fontSize: '2rem' }}>{activePlayer.Name[0]}</Avatar>}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
