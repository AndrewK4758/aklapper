import { css } from '@pigment-css/react';
import Box from '@pigment-css/react/Box';
import type { CSSProperties } from 'react';
import { shake } from '../../styles/base/animations';
import Theme from '../../styles/themes/theme';
import LandingBox from '../icons/landing_box_icon';

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
  const baseStyle = {
    position: 'relative' as CSSProperties['position'],
    flex: '1 0 50%',
  };

  const openStyle = { ...baseStyle, ...shakeIconAnimation };

  return (
    <Box
      className={css({
        height: '32rem',
        width: '32rem',
        [Theme.breakpoints.down('lg')]: {
          height: '21rem',
          width: '21rem',
        },
        [Theme.breakpoints.down('md')]: {
          height: '10rem',
          width: '10rem',
        },
      })}
    >
      <LandingBox
        id='open-menu'
        isLandingNavOpen={isLandingNavOpen}
        onHandleOpenMenu={onHandleNavbarClick}
        style={isLandingNavOpen ? baseStyle : openStyle}
      />
    </Box>
  );
}
