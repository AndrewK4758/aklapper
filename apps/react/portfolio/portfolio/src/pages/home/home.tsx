import Box, { type BoxProps } from '@mui/material/Box';
import { type ReactElement } from 'react';
import Intro from '../../components/intro/intro.jsx';
import PicutreAndResume from '../../components/intro/picture-resume.jsx';
import StyledRootComponentWrapper from '../../components/styled/styled_root_wrapper.js';
import Theme from '../../styles/theme.js';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {ReactElement} The rendered home component.
 */

const Home = ({ ...props }: BoxProps): ReactElement => (
  <StyledRootComponentWrapper {...props}>
    <Box
      sx={{
        display: 'flex',
        gap: Theme.spacing(2),
        [Theme.breakpoints.down('lg')]: {
          flexDirection: 'column',
        },
      }}
    >
      <Intro sx={{ flex: '0 1 70%' }} />
      <PicutreAndResume />
    </Box>
  </StyledRootComponentWrapper>
);

export default Home;
