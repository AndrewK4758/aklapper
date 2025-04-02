import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import { Fragment } from 'react';
import { Outlet } from 'react-router';
import ActivePlayerContextProvider from '../../context/active_player_context_provider';
import { GamesTheme as Theme } from '../../styles/games-theme';
import Footer from '../footer/footer';
import Header from '../header/header';

const breakpointsAppBar: SxProps = {
  paddingX: '1rem',
  display: 'flex',
  flexDirection: 'row',
  position: 'fixed',
  justifyContent: 'space-between',
  alignItems: 'center',
  zIndex: 10,
  backgroundColor: Theme.palette.background.paper,
  boxShadow: `0px 7px 8px -4px ${Theme.palette.success.main}, 0px 12px 17px 2px ${Theme.palette.primary.light}, 0px 5px 22px 4px ${Theme.palette.primary.dark}`,
  [Theme.breakpoints.down('md')]: {
    height: '35px',
    bottom: 0,
    top: 'calc(100vh - 100px)',
    boxShadow: `0px -7px 8px -4px ${Theme.palette.success.main}, 0px -12px 17px 2px ${Theme.palette.primary.light}, 0px -5px 22px 4px ${Theme.palette.primary.dark}`
  },
  [Theme.breakpoints.up('md')]: {
    height: '65px',
    top: 0
  }
};

const breakpointsFooter: SxProps = {
  position: 'fixed',
  bottom: 0,
  right: 0,
  left: 0,
  textAlign: 'center',
  alignContent: 'center',
  zIndex: 10,
  [Theme.breakpoints.down('md')]: {
    display: 'none'
  }
};

const breakpointsFooterText: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1.25rem'
  }
};

const breakpointsMain: SxProps = {
  textAlign: 'center',
  position: 'relative',
  backgroundColor: Theme.palette.background.default,
  zIndex: 9,
  paddingY: '10vh',
  height: 'fit-content',
  minHeight: '100vh',
  overflowY: 'hidden',
  [Theme.breakpoints.down('md')]: {
    top: 0,
    bottom: 100,
    paddingY: 0
  }
};

const Layout = () => (
  <Fragment key={'Layout'}>
    <ActivePlayerContextProvider>
      <Header componentAppBar={'header'} sxAppBar={breakpointsAppBar} />
      <Container component={'main'} id="main-wrapper" maxWidth={false} sx={breakpointsMain}>
        <Outlet />
      </Container>

      <Footer
        component={'footer'}
        breakpointsFooter={breakpointsFooter}
        breakpointsFooterText={breakpointsFooterText}
      />
    </ActivePlayerContextProvider>
  </Fragment>
);

export default Layout;
