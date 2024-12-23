import Box from '@mui/material/Box';
import { type JSX } from 'react';
import Intro from '../../components/intro/intro';
import { baseStyleForHomeItems } from '../../styles/intro-styles';
import PicutreAndResume from '../../components/intro/picture-resume';
import { flexColumnStyles } from '../../styles/prompt-builder-styles';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {JSX.Element} The rendered home component.
 */

const Home = (): JSX.Element => {
  return (
    <Box component={'div'} key={'home'} id="home" data-testid="home" sx={{ ...flexColumnStyles, width: '100vw' }}>
      <Box
        component={'div'}
        key={'intro-wrapper'}
        id="intro-wrapper"
        sx={{
          ...baseStyleForHomeItems,
          alignSelf: 'center',
          alignContent: 'space-between',
          gap: '2.5vw',
          width: '90vw'
        }}
      >
        <Intro />

        <PicutreAndResume />
      </Box>
    </Box>
  );
};

export default Home;
