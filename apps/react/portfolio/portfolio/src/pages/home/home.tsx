import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import { type ReactElement } from 'react';
import { IntroText } from '../../components/home/static/intro-text';
import TechStackLists from '../../components/home/tech-list/tech-stack-lists';
import ColoredBackground from '../../components/styled/colored_background';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {ReactElement} The rendered home component.
 */

const Home = (): ReactElement => (
  <ColoredBackground>
    <CardContent id='about-me-header-box' sx={{ display: 'flex' }}>
      <IntroText />
      <Divider orientation='vertical' flexItem={true} textAlign='center' />
      <TechStackLists />
    </CardContent>
  </ColoredBackground>
);

export default Home;
