import Box from '@mui/material/Box';
import { type CSSProperties, keyframes } from '@mui/material/styles';
import type { RefObject } from 'react';
import MenuIcon from '../icons/menu_icon';
import Explosion from '../lottie/explosion';

keyframes(`
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
`);

const shakeIconAnimation: CSSProperties = {
  animation: 'shake 2.25s 5',
  animationDelay: '3s',
};

interface LandingSvgAnimationProps {
  landingNavIsOpen: boolean;
  elementRef: RefObject<HTMLDivElement | null>;
  onHandleNavbarClick: () => void;
}

export default function LandingSvgAnimation({
  landingNavIsOpen,
  elementRef,
  onHandleNavbarClick,
}: LandingSvgAnimationProps) {
  return (
    <Box component={'section'} id='svg-animation-wrapper' sx={{ flex: '0 1 auto', position: 'relative' }}>
      <MenuIcon
        id='open-menu'
        landingNavIsOpen={landingNavIsOpen}
        onHandleOpenMenu={onHandleNavbarClick}
        style={!landingNavIsOpen ? shakeIconAnimation : {}}
      />
      {landingNavIsOpen && (
        <Explosion className='explosion-animation' elementRef={elementRef} onClick={onHandleNavbarClick} />
      )}
    </Box>
  );
}
