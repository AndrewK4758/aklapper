import type { JSX } from 'react';
import { Outlet } from 'react-router';
import '../../styles/main-styles.css';
import LayoutRootWrapper from '../styled/layout_root_wrapper';

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {JSX.Element} The rendered Layout component.
 */

const Layout = (): JSX.Element => {
  return (
    <LayoutRootWrapper>
      <Outlet />
    </LayoutRootWrapper>
  );
};

export default Layout;
