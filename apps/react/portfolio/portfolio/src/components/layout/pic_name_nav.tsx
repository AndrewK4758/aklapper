import { SectionTitle } from '@aklapper/react-shared';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import { memo, type ReactElement } from 'react';
import Theme from '../../styles/themes/theme';
import { ABOUT_ME_TITLE } from '../home/static/intro-static';

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

const myName = <SectionTitle title={ABOUT_ME_TITLE} variant='h1' />;

const avatarImg = (
  <img
    crossOrigin='anonymous'
    id={'card-media-resume-image'}
    data-testid={'card-media-resume-image'}
    src={'/images/self.webp'}
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

export default memo(function PicNameAndNav({ subheader }: PicNameAndNavProps) {
  return <CardHeader title={myName} subheader={subheader} avatar={avatarImg} {...slotProps} />;
});
