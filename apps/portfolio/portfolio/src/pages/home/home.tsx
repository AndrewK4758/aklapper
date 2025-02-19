import Box from '@mui/material/Box';
import { type JSX } from 'react';
import Intro from '../../components/intro/intro.jsx';
import PicutreAndResume from '../../components/intro/picture-resume.jsx';
import { introWrapperSxProps } from '../../styles/intro-styles.jsx';
import { flexColumnStyles } from '../../styles/pages-styles.jsx';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {JSX.Element} The rendered home component.
 */

const Home = (): JSX.Element => {
  return (
    <Box component={'div'} key={'home'} id="home" data-testid="home" sx={{ ...flexColumnStyles, width: '100vw' }}>
      <Box component={'div'} key={'intro-wrapper'} id="intro-wrapper" sx={introWrapperSxProps}>
        <Intro />
        <PicutreAndResume />
      </Box>
    </Box>
  );
};

export default Home;
