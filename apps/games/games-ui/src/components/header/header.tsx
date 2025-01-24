import { SxProps } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import { ElementType } from 'react';
import HeaderMenu from './header-menu/header-menu';
import GamesTheme from '../../styles/games-theme';

const breakpointsMenuItem: SxProps = {
  color: GamesTheme.palette.primary.main,
  backgroundColor: GamesTheme.palette.info.main,
  width: '100%',
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '17px'
  }
};

const breakpointsMenu: SxProps = {
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '2rem'
  }
};

export interface HeaderProps {
  componentAppBar: ElementType;
  sxAppBar?: SxProps;
  
}

export const Header = ({ componentAppBar, sxAppBar }: HeaderProps) => {

  return (
    <AppBar component={componentAppBar} sx={sxAppBar}>
      <HeaderMenu breakpointsMenuItem={breakpointsMenuItem} breakpointsMenu={breakpointsMenu} />

    </AppBar>
  );
};

export default Header;
