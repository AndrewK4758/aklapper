import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { useRef, type JSX } from 'react';
import { introCardSxProps, introTextSxProps, introTitleWrapperSxProps } from '../../styles/intro-styles.jsx';
import MenuIcon from '../icons/menu_icon.js';
import { ABOUT_ME_TITLE, IntroText } from './static/intro-text.jsx';

interface IntroProps {
  onHandleNavbarClick: () => void;
}

/**
 * This component renders a card containing a brief introduction of me.
 *
 * @returns {JSX.Element} The rendered intro component.
 */

const Intro = ({ onHandleNavbarClick }: IntroProps): JSX.Element => {
  const svgRef = useRef<HTMLDivElement>(null);
  return (
    <Card key={'intro-card'} id={'intro-card'} elevation={2} sx={introCardSxProps}>
      <CardContent component={'div'} id='about-me-header-box'>
        <Box sx={introTitleWrapperSxProps}>
          <Text
            id='about-me-title-text'
            data-testid='about-me-title-text'
            component={'h1'}
            titleVariant='h1'
            titleText={ABOUT_ME_TITLE}
          />

          <Box component={'div'} ref={svgRef} onClick={onHandleNavbarClick}>
            <MenuIcon id='open-menu' width={'96px'} height={'96px'} />
          </Box>
        </Box>
        <Box component={'div'} className='header-background' />

        <Text
          id='about-me-text'
          data-testid='about-me-text'
          component={'section'}
          titleVariant='body1'
          titleText={<IntroText />}
          sx={introTextSxProps}
        />
      </CardContent>
    </Card>
  );
};

export default Intro;
