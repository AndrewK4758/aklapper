import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Card, { type CardProps } from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { type ReactElement } from 'react';
import { ABOUT_ME_TITLE, IntroText } from './static/intro-text.jsx';

/**
 * This component renders a card containing a brief introduction of me.
 *
 * @returns {ReactElement} The rendered intro component.
 */

export default function Intro({ ...props }: CardProps): ReactElement {
  return (
    <Card {...props} id={'intro-card'}>
      <CardContent id='about-me-header-box'>
        <Box>
          <Text id='about-me-title-text' data-testid='about-me-title-text' variant='h1' children={ABOUT_ME_TITLE} />
        </Box>
        <Box className='animated-border' />
        <IntroText />
      </CardContent>
    </Card>
  );
}
