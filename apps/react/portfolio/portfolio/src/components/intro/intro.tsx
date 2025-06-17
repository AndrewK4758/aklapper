import { SectionTitle } from '@aklapper/react-shared';
import { type CardProps } from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import { type ReactElement } from 'react';
import Theme from '../../styles/theme.js';
import AnimatedBorderBox from '../styled/animated_border_box.js';
import StyledCard from '../styled/styled_card.js';
import { ABOUT_ME_TITLE, IntroText } from './static/intro-text.jsx';

/**
 * This component renders a card containing a brief introduction of me.
 *
 * @returns {ReactElement} The rendered intro component.
 */

export default function Intro({ ...props }: CardProps): ReactElement {
  return (
    // <StyledCard
    //   {...props}
    //   id={'intro-card'}
    //   sx={{ width: '60%', [Theme.breakpoints.down('lg')]: { width: 'fit-content' } }}
    // >
    //   <CardHeader
    //     title={
    //       // ABOUT_ME_TITLE
    //       <SectionTitle
    //         id='about-me-title-text'
    //         data-testid='about-me-title-text'
    //         variant='h1'
    //         title={ABOUT_ME_TITLE}
    //       />
    //     }
    //     avatar={
    //       <CardMedia
    //         rel='preload'
    //         crossOrigin=''
    //         component={'img'}
    //         id={'card-media-resume-image'}
    //         data-testid={'card-media-resume-image'}
    //         src={'/client/images/self.webp'}
    //         loading='eager'
    //         alt='andrew'
    //         sx={{ width: '100%', height: 'auto', borderRadius: Theme.shape.borderRadius }}
    //       />
    //     }
    //   />

    //   <AnimatedBorderBox />
    <CardContent id='about-me-header-box' sx={{ textAlign: 'justify' }}>
      <IntroText />
    </CardContent>
    // </StyledCard>
  );
}
