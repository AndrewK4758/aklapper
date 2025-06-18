import { SectionTitle } from '@aklapper/react-shared';
import CardHeader, { type CardHeaderSlotsAndSlotProps } from '@mui/material/CardHeader';
import { useNavigate } from 'react-router';
import Theme from '../../styles/theme';
import { ABOUT_ME_TITLE } from '../intro/static/intro-text';
import NavButton from '../navigation/nav_button';
import AnimatedBorderBox from '../styled/animated_border_box';

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

export default function PicNameAndNav() {
  const nav = useNavigate();

  return (
    <CardHeader
      title={myName}
      subheader={
        <AnimatedBorderBox>
          <NavButton
            buttonText={'CRUD'}
            tooltipTitle={'Navigate to CRUD app'}
            onHandleNavButtonClick={() => {
              nav('/crud');
            }}
          />
        </AnimatedBorderBox>
      }
      avatar={
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
      }
      {...slotProps}
    />
  );
}
