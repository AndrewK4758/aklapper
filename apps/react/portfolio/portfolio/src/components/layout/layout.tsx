import { CenteredFlexDiv, StyledCard, StyledRootComponentWrapper } from '@aklapper/react-shared';
import { type ReactElement } from 'react';
import { Outlet } from 'react-router';
import styles from '../../styles/layout.module.css';
import Footer from '../footer/footer';
import HeaderContactMenu from '../header/header';
import PicNameAndNav from './pic_name_nav';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function Layout(): ReactElement {
  return (
    <StyledRootComponentWrapper id='app-wrapper'>
      <HeaderContactMenu />

      <CenteredFlexDiv component={'main'} className={styles.main}>
        <StyledCard>
          <PicNameAndNav />
        </StyledCard>
        <StyledCard className={styles.outletCard}>
          <Outlet />
        </StyledCard>
      </CenteredFlexDiv>

      <Footer />
    </StyledRootComponentWrapper>
  );
}
