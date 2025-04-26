import Container from '@mui/material/Container';
import { Outlet } from 'react-router';
import ActivePlayerContextProvider from '../../context/active_player_context_provider';
import { breakpointsFooter, breakpointsFooterText, breakpointsMain } from '../../styles/layout-styles';
import Footer from '../footer/footer';
import Header from '../header/header';

const Layout = () => (
  <ActivePlayerContextProvider>
    <Header />
    <Container component={'main'} key={'main-container'} id='main-wrapper' maxWidth={false} sx={breakpointsMain}>
      <Outlet />
    </Container>
    <Footer component={'footer'} breakpointsFooter={breakpointsFooter} breakpointsFooterText={breakpointsFooterText} />
  </ActivePlayerContextProvider>
);

export default Layout;
