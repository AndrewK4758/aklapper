import Box from '@mui/material-pigment-css/Box';
import { shake } from '../../styles/base/animations';
import LandingBox from '../icons/landing_box_icon';

const landingBoxBaseStyle = {
  '@media (max-width: 1200px)': {
    scale: 0.75,
  },
};

const shakeIconAnimation = {
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
    <Box as={'div'} sx={{ flex: '1 1 auto' }}>
      <LandingBox
        id='open-menu'
        isLandingNavOpen={isLandingNavOpen}
        onHandleOpenMenu={onHandleNavbarClick}
        inheritViewBox={true}
        style={!isLandingNavOpen ? shakeIconAnimation : {}}
        sx={landingBoxBaseStyle}
      />
    </Box>
  );
}
