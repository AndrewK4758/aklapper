import { type ReactElement } from 'react';
import { Outlet } from 'react-router';
import Theme from '../../styles/theme';
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
    <StyledRootComponentWrapper id='app-wrapper' sx={{ borderRadius: 0, minHeight: '100vh', height: 'fit-content' }}>
      <HeaderContactMenu />

      <CenteredFlexDiv component={'main'} sx={{ padding: Theme.spacing(0, 4), flex: 0 }}>
        <StyledCard raised elevation={4} sx={{ width: '100%', flex: 1 }}>
          <PicNameAndNav />
          <Outlet />
        </StyledCard>
      </CenteredFlexDiv>

      <Footer />
    </StyledRootComponentWrapper>
  );
}
