import { StyledRootComponentWrapper } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import { useReducer } from 'react';
import { useNavigate } from 'react-router';
import BoxAnimation from '../../components/landing/box_animation';
import LandingHeader from '../../components/landing/header';
import Explosion from '../../components/landing/lottie/explosion';
import NavToHome from '../../components/landing/nav_home';
import { LandingActions, type LandingPageState, landingPageReducer } from '../../hooks/landing_page_reducer';

const EXPLOSION_FADE_OUT_TIME = 1100;
const ENTER_FADE_IN_TIME = EXPLOSION_FADE_OUT_TIME - 900;

const landingPageInitState: LandingPageState = {
  isExplosionVisible: true,
  isLandingNavOpen: false,
  isEnterVisible: false,
  motionOffset: 0,
};

export default function LandingPage({ ...props }) {
  const [state, dispatch] = useReducer(landingPageReducer, landingPageInitState);
  const nav = useNavigate();

  const onBoxAnimationClick = () => {
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
  };

  const animateMotionPath = () => {
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
  };

  const handleEnterClicked = () => {
    nav('portfolio', { relative: 'route' });
  };

  return (
    <StyledRootComponentWrapper {...props} id='landing-root' sx={{ minHeight: '100vh' }}>
      <LandingHeader isLandingNavOpen={state.isLandingNavOpen} />

      <Box
        as={'section'}
        id={'landing-svg-animations-wrapper'}
        sx={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', perspective: '800px' }}
      >
        <BoxAnimation isLandingNavOpen={state.isLandingNavOpen} onHandleNavbarClick={onBoxAnimationClick} />
        {state.isLandingNavOpen && <Explosion isVisible={state.isExplosionVisible} onClick={onBoxAnimationClick} />}
        {state.isLandingNavOpen && (
          <NavToHome
            isVisable={state.isEnterVisible}
            motionOffset={state.motionOffset}
            onHandleClickEnter={handleEnterClicked}
          />
        )}
      </Box>
    </StyledRootComponentWrapper>
  );
}
