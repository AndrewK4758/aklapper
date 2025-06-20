import type { SxProps } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import Theme from './themes/theme.js';

export const gamesPaperSxProps: SxProps = {
  width: '70vw',
  [Theme.breakpoints.down('lg')]: {
    width: '90vw',
    paddingY: 1,
  },
};

export const gamesButtonSxProps: SxProps = {
  display: 'flex',
  flexDirection: 'row',
  textAlign: 'center',
  [Theme.breakpoints.down('md')]: {
    p: 0,
  },
};

export const breakpointsBottomMenuGameBoard: SxProps = {
  display: 'flex',
  marginTop: '2rem',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  [Theme.breakpoints.down('lg')]: {
    marginTop: '1rem',
    fontSize: '2rem',
  },
};

export const breakpointsPlayerInTurnText: SxProps = {
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1em',
  },
};

export const breakpointsBottomMenuButtonsBox: SxProps = {
  flex: '0 1 30%',
  display: 'flex',
  justifyContent: 'space-evenly',
  [Theme.breakpoints.down('lg')]: {
    flexDirection: 'column',
    flex: 1,
    width: '100%',
    gap: 1,
  },
};

//-----ACTIVE AVATARS------//

export const activeGameHeaderBoxStyles: SxProps = { display: 'flex', flex: '1 0 100%', justifyContent: 'space-evenly' };

export const breakpointsActiveGameTitleContainer: SxProps = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: 4,
  [Theme.breakpoints.down('lg')]: {
    flex: '1 0 60%',
    paddingBottom: 1,
  },
};

export const breakpointsActiveGameTitleText: SxProps = {
  textAlign: 'left',
  flex: '0 1 35%',
  [Theme.breakpoints.down('lg')]: {
    flex: '1 0 100%',
    fontSize: '1.5rem',
    textAlign: 'center',
  },
};

export const activeAvatarsActivePlayersInGameListSxProps: SxProps = { display: 'flex', justifyContent: 'center' };

export const activeAvatarsActiveGameHeaderBoxSxProps: SxProps = {
  ...activeAvatarsActivePlayersInGameListSxProps,
  [Theme.breakpoints.down('lg')]: {
    gap: 2,
  },
};
export const breakpointsPlayersInGameBox: SxProps = {
  flex: '0 1 65%',
  display: 'flex',
  flexWrap: 'wrap',
  flexDirection: 'row',
  height: '100%',
  [Theme.breakpoints.down('lg')]: {},
};

export const breakpointsPlayersBox: SxProps = {
  flex: '0 1 auto',
  display: 'flex',
  flexDirection: 'row',

  [Theme.breakpoints.down('lg')]: {
    flexDirection: 'column',
  },
};

export const breakpointsPlayersInGameText: SxProps = {
  flex: '0 1 auto',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
  },
};

export const gamesButtonLabelsSxProps: SxProps = {
  color: 'inherit',
  textAlign: 'center',
  fontSize: '2rem',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
  },
};

//-------READY TO START BUTTON-------//

export const breakpointsStartGameButtonBox: SxProps = {
  flex: '0 1 20%',
  justifyItems: 'center',
  alignContent: 'center',
  [Theme.breakpoints.down('lg')]: {},
};

export const breakpointsStartGameButtonFormButton: SxProps = {
  textAlign: 'center',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '17px',
    width: 130,
    height: 35,
  },
};

//--------RESET GAME--------//

export const breakpointsResetGameButton: SxProps = {
  marginLeft: '.5rem',
  backgroundColor: Theme.palette.primary.main,
  fontSize: '1.75rem',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
    marginLeft: 0,
  },
};

//-------SHOW GAME BOARD-------//

export const breakpointsGameBoardBox: SxProps = {
  display: 'flex',
  flexWrap: 'wrap',
  flexDirection: 'row',
  border: `5px solid ${Theme.palette.primary.main}`,
  [Theme.breakpoints.up('lg')]: {
    boxShadow: `0px 7px 8px -4px ${Theme.palette.primary.main}, 0px 12px 17px 2px ${Theme.palette.primary.light}, 0px 5px 22px 4px ${Theme.palette.primary.dark}, 0px -7px 8px -4px ${Theme.palette.primary.main}, 0px -12px 17px 2px ${Theme.palette.primary.light}, 0px -5px 22px 4px ${Theme.palette.primary.dark}`,
  },
};

//-------SHOW GAME BOARD TIC TAC TOE-------//

export const breakpointsGameBoardBoxTicTacToe: SxProps = {
  display: 'flex',
  flexWrap: 'wrap',
  border: `5px solid ${Theme.palette.primary.main}`,
  height: '100%',
  minHeight: '55vh',
  maxHeight: '80vh',
  width: '50%',
  justifySelf: 'center',
  [Theme.breakpoints.down('lg')]: {
    width: '100%',
  },
};

//--------TAKE TURN--------//

export const breakpointsTakeTurnButton: SxProps = {
  backgroundColor: Theme.palette.primary.main,
  fontSize: '1.75rem',

  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
  },
};

//-------TAKE TURN TIC TAC TOE-------//

export const breakpointsTakeTurnButtonTTT: SxProps = {
  backgroundColor: Theme.palette.primary.main,
  fontSize: '1.75rem',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
    width: '100%',
  },
};

//-------ACTIVE GAME SESSION--------//

//-------C&L-------//

export const breakpointsRowSx: SxProps = {
  flex: '1 0 10%',
  height: '7vh',
  border: `3px solid ${Theme.palette.primary.main}`,
  alignContent: 'center',
  justifyContent: 'center',
  [Theme.breakpoints.down('md')]: {
    border: `1.5px solid ${Theme.palette.primary.main}`,
  },
};

export const breakpointsSpaceSx: SxProps = {
  fontSize: '1.5rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '.75rem',
  },
};

export const spaceStyle: SxProps = { display: 'flex', flex: '1 0 100%' };

export const avatarSize: CSSProperties = {
  alignSelf: 'self-start',
  width: '100%',
  height: '100%',
};

//--------TTT--------//

export const breakpointsRowTTTSx: SxProps = {
  display: 'flex',
  flex: 1,
  height: '100%',
  justifyContent: 'center',
  alignItems: 'center',
  flexWrap: 'nowrap',
  overflow: 'hidden',
  border: `3px solid ${Theme.palette.primary.main}`,
  [Theme.breakpoints.down('md')]: {
    border: `1.5px solid ${Theme.palette.primary.main}`,
  },
};

export const breakpointsSpaceTTTSx: SxProps = {
  display: 'none',
};

export const avatarTTTSize: CSSProperties = {
  width: 'auto',
  height: '150px',
};

export const rowSizeTTT: SxProps = { height: '33.4 ', flex: '1 0 100%' };

export const nonSelectedSpaceStyle: SxProps = {};

export const selectedSpaceStyle: SxProps = { backgroundColor: '#FFD300', color: '#58278b' };

export const svgSpaceTTTStyles: SxProps = {
  position: 'absolute',
  display: 'flex',
  justifyContent: 'center',
  flex: 1,
};

export const avatarSvgStyle: CSSProperties = {
  height: 'auto',
  width: '30%',
  maxWidth: '100px',
};
