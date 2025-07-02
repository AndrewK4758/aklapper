import { SectionTitle } from '@aklapper/react-shared';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import type { ReactElement } from 'react';
import self from '../../assets/images/self.webp';
import Theme from '../../styles/themes/theme';

const slotProps: CardHeaderSlotsAndSlotProps = {
  slotProps: {
    avatar: {
      sx: {
        flex: '0 1 15%',
      },
    },
    title: {
      color: 'textPrimary',
      fontFamily: 'League Gothic',
    },
  },
};

const myName = <SectionTitle title={"Hi, I'm Andrew Klapper"} variant='h1' />;

const avatarImg = (
  <img
    rel='preload'
    crossOrigin=''
    id={'card-media-resume-image'}
    data-testid={'card-media-resume-image'}
    src={self}
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
