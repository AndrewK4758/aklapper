import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import { Outlet } from 'react-router';
import ActivePlayerContextProvider from '../../context/active_player_context_provider';
import { GamesTheme as Theme } from '../../styles/games-theme';
import Footer from '../footer/footer';
import Header from '../header/header';

const breakpointsAppBar: SxProps = {
  height: '4rem',
  position: 'fixed'
};

const breakpointsFooter: SxProps = {
  textAlign: 'center',
  alignContent: 'center',
  [Theme.breakpoints.down('md')]: {
    display: 'none'
  }
};

const breakpointsFooterText: SxProps = {
  fontFamily: 'Jersey25-Charted',
  fontSize: '2.5rem',
  width: '100%',
  [Theme.breakpoints.down('md')]: {
    display: 'none'
  }
};

const breakpointsMain: SxProps = {
  textAlign: 'center',
  height: 'fit-content',
  paddingY: '4rem',
  [Theme.breakpoints.down('md')]: {}
};

const Layout = () => (
  <ActivePlayerContextProvider>
    <Header componentAppBar={'header'} sxAppBar={breakpointsAppBar} />
    <Container component={'main'} id="main-wrapper" maxWidth={false} sx={breakpointsMain}>
      <Outlet />
    </Container>

    <Footer component={'footer'} breakpointsFooter={breakpointsFooter} breakpointsFooterText={breakpointsFooterText} />
  </ActivePlayerContextProvider>
);

export default Layout;
