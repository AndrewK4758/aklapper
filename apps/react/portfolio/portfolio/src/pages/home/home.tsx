import { type BoxProps } from '@mui/material/Box';
import { type ReactElement } from 'react';
import Intro from '../../components/intro/intro';
import StyledRootComponentWrapper from '../../components/styled/styled_root_wrapper.js';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {ReactElement} The rendered home component.
 */

const Home = ({ ...props }: BoxProps): ReactElement => (
  <StyledRootComponentWrapper {...props}>
    <Intro />
  </StyledRootComponentWrapper>
);

export default Home;
