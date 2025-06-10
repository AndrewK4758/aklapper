import type { ReactElement } from 'react';
import { Outlet } from 'react-router';
import '../../styles/main-styles.css';
import StyledRootWrapper from '../components/styled/layout_root_wrapper';

//TODO move to pages directory

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function LandingPage(): ReactElement {
  return (
    <StyledRootWrapper>
      <Outlet />
    </StyledRootWrapper>
  );
}
