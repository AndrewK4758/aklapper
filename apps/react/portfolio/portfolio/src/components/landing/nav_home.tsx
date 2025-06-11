// import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps, Theme as ThemeType } from '@mui/material/styles';
import Theme from '../../styles/theme';
import EnterIcon from '../icons/enter_icon';

const MOTION_PATH =
  'm 260,212.3 c 93.2,-20.8 188.1,-35.7 283.8,-35.4 163.4,-4.2 328.3,-4.2 489.2,28 43,13.2 85,38.7 102,82.4 16,30.9 23,67.6 9,101 -8,33.9 -30,63.8 -63,76.3 -61,31.4 -131.7,24.9 -198,25.5 -53,-2 -194.8,11 -246.3,-3.9 -48.1,-14.3 -139.4,-45 -139.4,-88.4 0.3,-53.3 114.1,-97.2 134.6,-106.9 21.7,-8.8 88.1,-28.8 158.6,-32.8 13.6,-0.1 25.7,-0.2 39.4,-1.4';

interface NavToHomeProps {
  isVisable: boolean;
  motionOffset: number;
  onHandleClickEnter: () => void;
}

export default function NavToHome({ isVisable, motionOffset, onHandleClickEnter }: NavToHomeProps) {
  const enterIconStyle: SxProps<ThemeType> = {
    position: 'absolute',
    top: 165,
    left: 232,
    zIndex: 2,
    height: 'auto',
    width: '20em',
    [Theme.breakpoints.down('lg')]: {
      width: '10em',
      left: -70,
    },
    opacity: isVisable ? 1 : 0,
    offsetPath: `path('${MOTION_PATH}')`,
    offsetRotate: '0deg',
    offsetDistance: isVisable ? '100%' : '0%',
    offsetPosition: motionOffset,
    transform: `${isVisable ? 'scale(2.25)' : 'scale(0.3)'}`,

    transition: 'offset-distance 1s ease-out, opacity 0.7s ease-in, transform 1.2s ease-out',
  };
  return <EnterIcon isVisible={isVisable} onHandleClickEnter={onHandleClickEnter} sx={enterIconStyle} />;
}
