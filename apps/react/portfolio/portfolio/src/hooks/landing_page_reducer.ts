export type LandingPageState = {
  isExplosionVisible: boolean;
  isLandingNavOpen: boolean;
  isEnterVisible: boolean;
  motionOffset: number;
};

export type LandingPageAction = {
  type: (typeof LandingActions)[keyof typeof LandingActions];
  payload: Pick<LandingPageState, keyof LandingPageState>;
};

export const LandingActions = Object.freeze({
  EXPLOSION_VISIBLE: Symbol('explosion'),
  NAV_OPEN: Symbol('nav-open'),
  ENTER_VISIBLE: Symbol('enter-visible'),
  MOTION_OFFSET: Symbol('motion-offset'),
});

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
