import { type ReactElement } from 'react';
import { Outlet } from 'react-router';
import Footer from '../footer/footer';
import HeaderContactMenu from '../header/header.js';
import CenteredFlexDiv from '../styled/centered_flexbox';
import StyledCard from '../styled/styled_card';
import StyledRootComponentWrapper from '../styled/styled_root_wrapper';
import PicNameAndNav from './pic_name_nav';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function Layout(): ReactElement {
  return (
    <StyledRootComponentWrapper id='app-wrapper' sx={{ minHeight: '100vh', height: 'fit-content' }}>
      <HeaderContactMenu />

      <CenteredFlexDiv component={'main'} marginX={'5%'}>
        <StyledCard raised elevation={4}>
          <PicNameAndNav />
          <Outlet />
        </StyledCard>
      </CenteredFlexDiv>

      <Footer />
    </StyledRootComponentWrapper>
  );
}
