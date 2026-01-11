import { LandingActions, type LandingPageAction, type LandingPageState } from '../types/landing/landing';

export const landingPageReducer = (state: LandingPageState, action: LandingPageAction): LandingPageState => {
  const { type, payload } = action;

  switch (type) {
    case LandingActions.EXPLOSION_VISIBLE: {
      return {
        ...state,
        isExplosionVisible: payload.isExplosionVisible,
      };
    }

    case LandingActions.NAV_OPEN: {
      return {
        ...state,
        isLandingNavOpen: payload.isLandingNavOpen,
      };
    }

    case LandingActions.ENTER_VISIBLE: {
      return {
        ...state,
        isEnterVisible: payload.isEnterVisible,
      };
    }

    case LandingActions.MOTION_OFFSET: {
      return {
        ...state,
        motionOffset: payload.motionOffset,
      };
    }

    default: {
      return state;
    }
  }
};
