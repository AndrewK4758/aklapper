import { type ReactElement } from 'react';
import { Outlet } from 'react-router';
import Footer from '../footer/footer';
import HeaderContactMenu from '../header/header.js';
import CenteredFlexDiv from '../styled/centered_flexbox';
import StyledRootComponentWrapper from '../styled/styled_root_wrapper';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function Layout(): ReactElement {
  return (
    <StyledRootComponentWrapper id='app-wrapper' sx={{ borderRadius: 0, minHeight: '100vh', height: 'fit-content' }}>
      <HeaderContactMenu />

      <CenteredFlexDiv component={'main'}>
        <Outlet />
      </CenteredFlexDiv>

      <Footer />
    </StyledRootComponentWrapper>
  );
}
