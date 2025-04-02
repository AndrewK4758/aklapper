import { Text } from '@aklapper/react-shared';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/material/styles';
import { useContext, type ElementType } from 'react';
import ActivePlayerContext, { ActivePlayerContextProps } from '../../context/active-player-context';
import GamesTheme from '../../styles/games-theme';
import HeaderMenu from './header-menu/header-menu';

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
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  return (
    <AppBar component={componentAppBar} sx={sxAppBar}>
      <HeaderMenu breakpointsMenuItem={breakpointsMenuItem} breakpointsMenu={breakpointsMenu} />
      {activePlayer.Name && (
        <Box
          component={'div'}
          id="active-player-wrapper"
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}
        >
          <Text titleVariant="h4" titleText="Active Player: " component={'h4'} />
          <Text
            titleVariant={'body1'}
            titleText={activePlayer.Name}
            component={'p'}
            sx={{ color: GamesTheme.palette.primary.main, fontSize: '2.5rem' }}
          />
        </Box>
      )}
    </AppBar>
  );
};

export default Header;
