import type { ILiteSpace, Row } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import { type ActionDispatch } from 'react';
import Theme from '../../../styles/themes/theme';
import type { IActiveGameInfo } from '../../../types/types';
import type { Action } from './socket-reducer';
import SpaceTicTacToe from './space_tic_tac_toe';

export interface GameBoardPropsTicTacToe {
  row: Row;
  id?: string | number;
  state: IActiveGameInfo;
  dispatch: ActionDispatch<[action: Action]>;
}

const RowTicTacToe = function ({ row, id, state, dispatch }: GameBoardPropsTicTacToe) {
  return (
    <Box as={'section'} id={`row-${id}`} className={css({ display: 'flex', flex: 1, gap: Theme.spacing(2) })}>
      {row.map((space: ILiteSpace, i: number) => (
        <SpaceTicTacToe
          key={`${space.display}-${i}`}
          id={`${space.display}-${i}`}
          space={space}
          state={state}
          dispatch={dispatch}
        />
      ))}
    </Box>
  );
};

export default RowTicTacToe;
