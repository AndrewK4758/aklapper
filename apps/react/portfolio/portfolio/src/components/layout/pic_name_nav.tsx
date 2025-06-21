import { SectionTitle } from '@aklapper/react-shared';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import self from '../../assets/images/self.webp';
import Theme from '../../styles/themes/theme';
import { ABOUT_ME_TITLE } from '../intro/static/intro-text';
import NavBar from '../navigation/nav_bar';

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
console.log(self);
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

export default function PicNameAndNav() {
  return <CardHeader title={myName} subheader={<NavBar />} avatar={avatarImg} {...slotProps} />;
}
