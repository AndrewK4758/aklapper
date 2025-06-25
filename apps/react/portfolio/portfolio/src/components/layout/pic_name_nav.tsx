import { SectionTitle } from '@aklapper/react-shared';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import type { ReactElement } from 'react';
import Theme from '../../styles/themes/theme';
import { ABOUT_ME_TITLE } from '../intro/static/intro-text';

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
    alt='Andrew'
    style={{
      width: '100%',
      borderRadius: Theme.shape.borderRadius,
    }}
  />
);

interface PicNameAndNavProps {
  subheader: ReactElement;
}

export default function PicNameAndNav({ subheader }: PicNameAndNavProps) {
  return <CardHeader suppressHydrationWarning title={myName} subheader={subheader} avatar={avatarImg} {...slotProps} />;
}
