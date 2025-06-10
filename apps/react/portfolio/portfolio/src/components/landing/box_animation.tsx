import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme as ThemeType } from '@mui/material/styles';
import LandingBox from '../icons/landing_box_icon';

const shake = keyframes`
  1.25%,
  11.25% {
    transform: rotateZ(-0.75deg);
  }
  2.5%,
  10% {
    transform: rotateZ(1.5deg);
  }
  3.75%,
  6.75%,
  8.75% {
    transform: rotateZ(-3deg);
  }
  5%,
  7.5% {
    transform: rotateZ(3deg);
  }
  11.5% {
    transform: rotateZ(0deg);
  }
  100% {
    transition: rotateZ(0deg);
  }
`;

const shakeIconAnimation: SxProps<ThemeType> = {
  animation: `${shake} 2.25s 5`,
  animationDelay: '3s',
  transformOrigin: 'center',
};

interface LandingBoxProps {
  isLandingNavOpen: boolean;
  onHandleNavbarClick: () => void;
}

export default function BoxAnimation({ isLandingNavOpen, onHandleNavbarClick }: LandingBoxProps) {
  return (
    <Box component={'div'} flex={'0 1 auto'}>
      <LandingBox
        id='open-menu'
        isLandingNavOpen={isLandingNavOpen}
        onHandleOpenMenu={onHandleNavbarClick}
        inheritViewBox={true}
        sx={!isLandingNavOpen ? shakeIconAnimation : null}
      />
    </Box>
  );
}
