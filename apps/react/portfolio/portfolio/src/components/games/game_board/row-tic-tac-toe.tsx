import type { ILiteSpace, Row } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';

import Theme from '../../../styles/themes/theme';
import SpaceTicTacToe from './space_tic_tac_toe.js';

export interface GameBoardPropsTicTacToe {
  row: Row;
  id?: string | number;
  state: string | undefined;
  setStateAction: (space: string) => void;
}

export default function RowTicTacToe({ row, id, state, setStateAction }: GameBoardPropsTicTacToe) {
  return (
    <Box as={'section'} id={`row-${id}`} sx={{ display: 'flex', flex: 1, gap: Theme.spacing(2) }}>
      {row.map((space: ILiteSpace, i: number) => (
        <SpaceTicTacToe
          key={`${space.display}-${i}`}
          id={`${space.display}-${i}`}
          space={space}
          state={state}
          setStateAction={setStateAction}
        />
      ))}
    </Box>
  );
}
