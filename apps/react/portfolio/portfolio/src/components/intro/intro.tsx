import { type CardProps } from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import { type ReactElement } from 'react';
import Theme from '../../styles/theme.js';
import { IntroText } from './static/intro-text.jsx';
import TechStackLists from './tech-list/tech-stack-lists.js';

/**
 * This component renders a card containing a brief introduction of me.
 *
 * @returns {ReactElement} The rendered intro component.
 */

export default function Intro({ ...props }: CardProps): ReactElement {
  return (
    <CardContent id='about-me-header-box' sx={{ display: 'flex', gap: Theme.spacing(4) }}>
      <IntroText sx={{ flex: '30%', textAlign: 'start' }} />
      <Divider
        orientation='vertical'
        flexItem={true}
        textAlign='center'
        sx={{ borderColor: Theme.palette.primary.dark }}
      />

      <TechStackLists />
    </CardContent>
  );
}
