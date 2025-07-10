import { CenteredFlexDiv, StyledCard, StyledRootComponentWrapper } from '@aklapper/react-shared';
import { css } from '@pigment-css/react';
import { useState, type ReactElement } from 'react';
import { Outlet, useNavigate } from 'react-router';
import Footer from '../footer/footer';
import HeaderContactMenu from '../header/header';
import AppNavBar from './navigation/app_nav_bar';
import PicNameAndNav from './pic_name_nav';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function Layout(): ReactElement {
  const [openEmail, setOpenEmail] = useState(false);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);

  const handleToggleContactMenu = () => {
    setIsContactMenuOpen(!isContactMenuOpen);
  };

  const handleOpenEmail = () => {
    setOpenEmail(!openEmail);
  };
  const nav = useNavigate();

  const handleOpenPrivacyPolicy = () => {
    nav('privacy-policy', { relative: 'route' });
  };
  return (
    <StyledRootComponentWrapper id='app-wrapper' sx={{ minHeight: '100vh', height: 'fit-content' }}>
      <HeaderContactMenu
        isContactMenuOpen={isContactMenuOpen}
        openEmail={openEmail}
        handleOpenEmail={handleOpenEmail}
        handleToggleContactMenu={handleToggleContactMenu}
      />

      <CenteredFlexDiv component={'main'} className={css({ margin: '0 2.5%', padding: 0, minHeight: '100vh' })}>
        <StyledCard>
          <PicNameAndNav subheader={<AppNavBar />} />
        </StyledCard>
        <StyledCard
          className={css({
            backgroundColor: 'transparent',
            width: '100%',
            padding: 0,
          })}
        >
          <Outlet />
        </StyledCard>
      </CenteredFlexDiv>

      <Footer handleOpenPrivacyPolicy={handleOpenPrivacyPolicy} />
    </StyledRootComponentWrapper>
  );
}
