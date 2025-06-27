import { type SxProp } from '@mui/material-pigment-css';
import type { SxProps } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import Theme from './themes/theme.js';

export const gamesPaperSxProps: SxProps = {
  width: '100%',
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

//-----ACTIVE AVATARS------//

export const activeGameHeaderBoxStyles: SxProps = { display: 'flex', flex: '1 0 100%', justifyContent: 'space-evenly' };

export const activeAvatarsActivePlayersInGameListSxProps: SxProps = { display: 'flex', justifyContent: 'center' };

export const breakpointsPlayersBox: SxProps = {
  flex: '0 1 auto',
  display: 'flex',
  flexDirection: 'row',

  [Theme.breakpoints.down('lg')]: {
    flexDirection: 'column',
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

//-------TAKE TURN TIC TAC TOE-------//

export const breakpointsTakeTurnButtonTTT: SxProps = {
  backgroundColor: Theme.palette.primary.main,
  fontSize: '1.75rem',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
    width: '100%',
  },
};

//-------C&L-------//

export const breakpointsRowSx: SxProp = {
  display: 'flex',
  backgroundColor: Theme.palette.background.paper,
  border: `1px solid ${Theme.palette.primary.main}`,
  borderRadius: '16px',
  flex: 1,
  minHeight: '90px',
  justifyContent: 'center',
  alignItems: 'center',
};

export const spaceStyle: SxProps = { display: 'flex', flex: '1 0 100%' };

export const avatarSize: CSSProperties = {
  alignSelf: 'self-start',
  width: '55%',
  height: 'auto',
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
  width: '25%',
  maxWidth: '90px',
};
