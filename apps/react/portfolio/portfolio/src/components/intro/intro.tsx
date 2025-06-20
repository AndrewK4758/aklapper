import CardContent, { type CardContentProps } from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import { type ReactElement } from 'react';
import { IntroText } from './static/intro-text';
import TechStackLists from './tech-list/tech-stack-lists';

/**
 * This component renders a card containing a brief introduction of me.
 *
 * @returns {ReactElement} The rendered intro component.
 */

export default function Intro({ ...props }: CardContentProps): ReactElement {
  return (
    <CardContent {...props} id='about-me-header-box'>
      <IntroText />
      <Divider orientation='vertical' flexItem={true} textAlign='center' />
      <TechStackLists />
    </CardContent>
  );
}
