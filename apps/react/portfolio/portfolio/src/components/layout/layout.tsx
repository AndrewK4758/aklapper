import { type ReactElement, type ReactNode } from 'react';
import CenteredFlexDiv from '../styled/centered_flexbox';
import StyledCard from '../styled/styled_card';
import StyledRootComponentWrapper from '../styled/styled_root_wrapper';

interface LayoutProps {
  header: ReactElement;
  footer: ReactElement;
  navBar: ReactElement;
  children: ReactNode;
}

/**
 * This component renders the main layout of the application.
 * It includes the header, home section, navigation menus, main content area, and footer.
 *
 * @returns {ReactElement} The rendered Layout component.
 */

export default function Layout({ header, footer, navBar, children }: LayoutProps): ReactElement {
  return (
    <StyledRootComponentWrapper id='app-wrapper' sx={{ minHeight: '100vh', height: 'fit-content' }}>
      {header}

      <CenteredFlexDiv component={'main'} sx={{ margin: '0 5%' }}>
        <StyledCard>
          {navBar}
          {children}
        </StyledCard>
      </CenteredFlexDiv>

      {footer}
    </StyledRootComponentWrapper>
  );
}
