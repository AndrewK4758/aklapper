import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import { memo, type ActionDispatch } from 'react';
import type { IActiveGameInfo } from '../../../types/types';
import RowTicTacToe from './row-tic-tac-toe';
import type { Action } from './socket-reducer';

export interface GameBoardPropsTicTacToe {
  state: IActiveGameInfo;
  id?: string | number;
  dispatch: ActionDispatch<[action: Action]>;
}

const GameBoardTicTacToe = memo(function ({ id, state, dispatch }: GameBoardPropsTicTacToe) {
  const { gameBoard } = state;
  return (
    <Box as={'section'} id={`row-${id}`} className={css({ flex: '0 1 95%', display: 'flex', flexDirection: 'column' })}>
      {gameBoard.map((row, idx) => (
        <RowTicTacToe key={`row-${idx}`} row={row} id={`row-${idx}`} state={state} dispatch={dispatch} />
      ))}
    </Box>
  );
});

export default GameBoardTicTacToe;
