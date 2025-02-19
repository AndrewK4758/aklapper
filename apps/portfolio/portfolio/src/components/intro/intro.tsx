import { Text } from '@aklapper/react-shared';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import type { JSX } from 'react';
import { introCardSxProps, introTextSxProps, introTitleTextSxProps } from '../../styles/intro-styles.jsx';
import { ABOUT_ME_TITLE, IntroText } from './static/intro-text.jsx';

/**
 * This component renders a card containing a brief introduction of me.
 *
 * @returns {JSX.Element} The rendered intro component.
 */

const Intro = (): JSX.Element => (
  <Card key={'intro-card'} id={'intro-card'} elevation={2} sx={introCardSxProps}>
    <CardContent component={'div'} id="about-me-header-box" key="about-me-header-box">
      <Text
        key={'about-me-title-text'}
        id="about-me-title-text"
        data-testid="about-me-title-text"
        component={'h1'}
        titleVariant="h1"
        titleText={ABOUT_ME_TITLE}
        sx={introTitleTextSxProps}
      />

      <Text
        key={'about-me-text'}
        id="about-me-text"
        data-testid="about-me-text"
        component={'p'}
        titleVariant="body1"
        titleText={<IntroText />}
        sx={introTextSxProps}
      />
    </CardContent>
  </Card>
);

export default Intro;
