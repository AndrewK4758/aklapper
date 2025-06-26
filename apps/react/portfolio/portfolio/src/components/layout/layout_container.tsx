import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import Footer from '../footer/footer';
import HeaderContactMenu from '../header/header.js';
import NavBar from '../navigation/nav_bar';
import Layout from './layout';
import PicNameAndNav from './pic_name_nav';

export default function LayoutContainer() {
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
    <Layout
      header={
        <HeaderContactMenu
          isContactMenuOpen={isContactMenuOpen}
          openEmail={openEmail}
          handleOpenEmail={handleOpenEmail}
          handleToggleContactMenu={handleToggleContactMenu}
        />
      }
      navBar={<PicNameAndNav subheader={<NavBar />} />}
      footer={<Footer handleOpenPrivacyPolicy={handleOpenPrivacyPolicy} />}
    >
      <Outlet />
    </Layout>
  );
}
