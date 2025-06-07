// import { Text } from '@aklapper/react-shared';
// import Box from '@mui/material/Box';
import type { JSX } from 'react';
import { useState } from 'react';
// import { Link, Outlet } from 'react-router';
// import Home from '../../pages/home/home.jsx';
import LandingPage from '../../pages/landing/landing.jsx';
// import {
// baseStyleForLayoutItems,
// footerWrapperSxProps,
// homeWrapperSxProps,
// mainWrapperSxProps,
// outletWrapperSxProps,
// } from '../../styles/layout-styles.jsx';
import Box from '@mui/material/Box';
import '../../styles/main-styles.css';
// import Header from '../header/header.js';
// import MenuIcon from '../icons/menu_icon.js';
// import Header from '../header/header.jsx';
/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {JSX.Element} The rendered Layout component.
 */

const Layout = (): JSX.Element => {
  // const [loading, setLoading] = useState(false);
  const [navbarIsOpen, setNavbarIsOpen] = useState(false);

  const onHandleNavbarClick = () => {
    setNavbarIsOpen(!navbarIsOpen);
  };

  console.log(navbarIsOpen);

  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', width: '100vw', minHeight: '100vh', height: 'fit-content', padding: 4 }}
    >
      <LandingPage
        isOpen={navbarIsOpen}
        onHandleNavbarClick={onHandleNavbarClick}
        sx={{ flex: '1 0 100%', display: 'flex', flexDirection: 'column', border: 3 }}
      />
      {/* <Box component={'main'} key={'main-wrapper'} id='main-wrapper' data-testid='main-wrapper' sx={mainWrapperSxProps}>
        <Box
          component={'div'}
          key={'home-wrapper'}
          id='home-wrapper'
          data-testid='home-wrapper'
          sx={homeWrapperSxProps}
        >
          <Home onHandleNavbarClick={onHandleNavbarClick} />
        </Box>
        <Box component={'div'} key={'outlet-ref-wrapper'} id='outlet-ref-wrapper' sx={outletWrapperSxProps}>
          <Outlet context={{ loading, setLoading }} />
        </Box>
      </Box>
      <Box
        component={'div'}
        key={'footer-wrapper'}
        id='footer-wrapper'
        data-testid='footer-wrapper'
        sx={footerWrapperSxProps}
      >
        <Link
          key={'privacy-policy-link'}
          id={'privacy-policy-link'}
          to={'/privacy-policy'}
          rel='noopener noreferrer'
          data-testid={'privacy-policy-link'}
        >
          Privacy Policy
        </Link>
      </Box>
      <Header /> */}
    </Box>
  );
};

export default Layout;
