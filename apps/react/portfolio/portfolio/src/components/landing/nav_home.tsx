import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import EnterIcon from '../icons/enter_icon';

const MOTION_PATH =
  'm 130,137.4 143.6,-3.7 105.4,-3.7 188.6,3 177.2,24.6 149.4,38.9 57.8,58.9 15.9,61.2 2.1,75.5 -47.4,69 -76.5,33.9 -82.9,-5.2 -158.1,-19.5 -109.8,-60.9 -26.6,-61.8 35.9,-50.4 93.9,-60.3 52.2,0.4';

interface NavToHomeProps extends Omit<BoxProps, 'component'> {
  isVisable: boolean;
  motionOffset: number;
  onHandleClickEnter: () => void;
}

export default function NavToHome({ isVisable, motionOffset, onHandleClickEnter, ...props }: NavToHomeProps) {
  const enterIconStyle: SxProps<Theme> = {
    position: 'absolute',
    zIndex: 2,
    height: 'auto',
    width: '400px',
    opacity: isVisable ? 1 : 0,
    offsetPath: `path('${MOTION_PATH}')`,
    offsetDistance: isVisable ? '100%' : '0%',
    offsetPosition: motionOffset,
    transform: `translate(-150px, 135px) ${isVisable ? 'scale(2.2)' : 'scale(0.4)'}`,

    transition: 'offset-distance 1.2s ease-out, opacity 0.5s ease-in, transform 1.2s ease-out',
  };
  return (
    <Box {...props} component={'div'} sx={{ flex: '0 1 auto', border: '3px solid red' }}>
      <EnterIcon isVisible={isVisable} onHandleClickEnter={onHandleClickEnter} sx={enterIconStyle} />
    </Box>
  );
}
