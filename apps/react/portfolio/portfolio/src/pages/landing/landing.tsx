import Box, { type BoxProps } from '@mui/material/Box';
import { useState } from 'react';
import BoxAnimation from '../../components/landing/box_animation';
import LandingHeader from '../../components/landing/header';
import Explosion from '../../components/landing/lottie/explosion';
import NavToHome from '../../components/landing/nav_home';
import StyledRootComponentWrapper from '../../components/styled/layout_root_wrapper';

const EXPLOSION_FADE_OUT_TIME = 1100;
const ENTER_FADE_IN_TIME = EXPLOSION_FADE_OUT_TIME - 900;

export default function LandingPage({ ...props }: BoxProps) {
  const [isExplosionVisible, setIsExplosionVisible] = useState(true);
  const [isLandingNavOpen, setIsLandingNavOpen] = useState(false);
  const [isEnterVisible, setIsEnterVisible] = useState(false);
  const [motionOffset, setMotionOffset] = useState(0);

  const onBoxAnimationClick = () => {
    setIsEnterVisible(false);
    setMotionOffset(0);
    if (!isLandingNavOpen) {
      setIsExplosionVisible(true);
      setTimeout(() => {
        setIsExplosionVisible(false);
      }, EXPLOSION_FADE_OUT_TIME);
      setTimeout(() => {
        setIsEnterVisible(true);
        animateMotionPath();
      }, ENTER_FADE_IN_TIME);
    }
    setIsLandingNavOpen(!isLandingNavOpen);
  };

  const animateMotionPath = () => {
    let startTime: number | null = null;

    const duration = 200;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / duration);
      setMotionOffset(progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  return (
    <StyledRootComponentWrapper {...props} component={'div'} id='landing-root'>
      <LandingHeader isLandingNavOpen={isLandingNavOpen} />

      <Box
        component={'section'}
        id={'landing-svg-animations-wrapper'}
        flex={1}
        display={'flex'}
        position={'relative'}
        border={'5px solid blue'}
        overflow={'hidden'}
        sx={{ perspective: '800px' }}
      >
        <BoxAnimation isLandingNavOpen={isLandingNavOpen} onHandleNavbarClick={onBoxAnimationClick} />
        {isLandingNavOpen && <Explosion isVisible={isExplosionVisible} onClick={onBoxAnimationClick} />}
        {isLandingNavOpen && (
          <NavToHome
            isVisable={isEnterVisible}
            motionOffset={motionOffset}
            onHandleClickEnter={() => {
              console.log('clicked enter');
            }}
          />
        )}
      </Box>
    </StyledRootComponentWrapper>
  );
}
