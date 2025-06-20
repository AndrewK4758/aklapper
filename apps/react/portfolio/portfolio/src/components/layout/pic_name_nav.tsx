import { SectionTitle } from '@aklapper/react-shared';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import Theme from '../../styles/themes/theme.js';
import { ABOUT_ME_TITLE } from '../intro/static/intro-text';

import NavBar from '../navigation/nav_bar.js';

const slotProps: CardHeaderSlotsAndSlotProps = {
  slotProps: {
    avatar: {
      sx: {
        flex: '0 1 15%',
      },
    },
  },
};

const myName = <SectionTitle title={ABOUT_ME_TITLE} variant='h1' />;

const avatarImg = (
  <img
    rel='preload'
    crossOrigin=''
    id={'card-media-resume-image'}
    data-testid={'card-media-resume-image'}
    src={'/client/images/self.webp'}
    loading='eager'
    alt='andrew'
    style={{
      width: '100%',
      borderRadius: Theme.shape.borderRadius,
    }}
  />
);

export default function PicNameAndNav() {
  return <CardHeader title={myName} subheader={<NavBar />} avatar={avatarImg} {...slotProps} />;
}
