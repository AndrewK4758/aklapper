import Box from '@mui/material/Box';
import { useCallback, useReducer } from 'react';
import { useNavigate } from 'react-router';
import BoxAnimation from '@components/landing/box_animation';
import Text from '@components/landing/text';
import Explosion from '@components/landing/lottie/explosion';
import NavToHome from '@components/landing/nav_home';
import { landingPageReducer } from '@hooks/landing_page_reducer';
import styles from '@styles/landing/landing.module.css';
import { StyledRootComponentWrapper } from '@aklapper/react-shared';
import { LandingActions, type LandingPageState } from '@projectTypes/landing/landing.js';

const EXPLOSION_FADE_OUT_TIME = 1100;
const ENTER_FADE_IN_TIME = EXPLOSION_FADE_OUT_TIME - 900;

const landingPageInitState: LandingPageState = {
  isExplosionVisible: true,
  isLandingNavOpen: false,
  isEnterVisible: false,
  motionOffset: 0,
};

export default function LandingPage() {
  const [state, dispatch] = useReducer(landingPageReducer, landingPageInitState);
  const nav = useNavigate();

  const onBoxAnimationClick = useCallback(() => {
    dispatch({ type: LandingActions.ENTER_VISIBLE, payload: { ...state, isEnterVisible: false } });
    dispatch({ type: LandingActions.MOTION_OFFSET, payload: { ...state, motionOffset: 0 } });

    if (!state.isLandingNavOpen) {
      dispatch({ type: LandingActions.EXPLOSION_VISIBLE, payload: { ...state, isExplosionVisible: true } });

      setTimeout(() => {
        dispatch({ type: LandingActions.EXPLOSION_VISIBLE, payload: { ...state, isExplosionVisible: false } });
      }, EXPLOSION_FADE_OUT_TIME);

      setTimeout(() => {
        dispatch({ type: LandingActions.ENTER_VISIBLE, payload: { ...state, isEnterVisible: true } });
        animateMotionPath();
      }, ENTER_FADE_IN_TIME);
    }

    dispatch({ type: LandingActions.NAV_OPEN, payload: { ...state, isLandingNavOpen: !state.isLandingNavOpen } });
  }, [state, dispatch]);

  const animateMotionPath = useCallback(() => {
    let startTime: number | null = null;

    const duration = 200;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / duration);
      dispatch({ type: LandingActions.MOTION_OFFSET, payload: { ...state, motionOffset: progress } });
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, []);

  const handleEnterClicked = useCallback(() => {
    nav('portfolio', { relative: 'route', replace: true });
  }, []);

  return (
    <StyledRootComponentWrapper className={styles.container} id='landing-root'>
      <Text isLandingNavOpen={state.isLandingNavOpen} />

      <Box className={styles.animationsWrapper}>
        <BoxAnimation isLandingNavOpen={state.isLandingNavOpen} onHandleNavbarClick={onBoxAnimationClick} />
        {state.isLandingNavOpen && (
          <>
            <Explosion isVisible={state.isExplosionVisible} onClick={onBoxAnimationClick} />
            <NavToHome
              isVisible={state.isEnterVisible}
              motionOffset={state.motionOffset}
              onHandleClickEnter={handleEnterClicked}
            />
          </>
        )}
      </Box>
    </StyledRootComponentWrapper>
  );
}
