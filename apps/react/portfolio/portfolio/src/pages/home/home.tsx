import { ColoredBackground } from '@aklapper/react-shared';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type ReactElement } from 'react';
import { IntroText } from '../../components/home/static/intro-text';
import TechStackLists from '../../components/home/tech-list/tech-stack-lists';
import Theme from '../../styles/themes/theme';

/**
 * This is the main home component that renders the introduction section of the portfolio website.
 * It includes a brief introduction, a picture with a resume download button, and a list of technologies I am familiar with.
 *
 * @returns {ReactElement} The rendered home component.
 */

export default function Home(): ReactElement {
  const mediaQuery = useMediaQuery(Theme.breakpoints.down('md'));
  return (
    <ColoredBackground>
      <CardContent id='about-me-header-box' sx={{ display: 'flex', flexDirection: mediaQuery ? 'column' : 'row' }}>
        <IntroText />
        <Divider orientation={mediaQuery ? 'horizontal' : 'vertical'} flexItem={true} textAlign='center' />
        <TechStackLists />
      </CardContent>
    </ColoredBackground>
  );
}
