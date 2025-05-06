import Container from '@mui/material/Container';
import { Outlet } from 'react-router';
import ActivePlayerContextProvider from '../../context/active_player_context_provider';
import MessageContextProvider from '../../context/messages_context_provider';
import WebsocketContextProvider from '../../context/websocket_context_provider';
import { breakpointsFooter, breakpointsFooterText, breakpointsMain } from '../../styles/layout-styles';
import Footer from '../footer/footer';
import Header from '../header/header';

const Layout = () => (
  <ActivePlayerContextProvider>
    <Header />
    <WebsocketContextProvider key={'lobby-websocket-provider'}>
      <MessageContextProvider key={'messages-provider'}>
        <Container component={'main'} key={'main-container'} id='main-wrapper' maxWidth={false} sx={breakpointsMain}>
          <Outlet />
        </Container>
      </MessageContextProvider>
    </WebsocketContextProvider>
    <Footer component={'footer'} breakpointsFooter={breakpointsFooter} breakpointsFooterText={breakpointsFooterText} />
  </ActivePlayerContextProvider>
);

export default Layout;
