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
