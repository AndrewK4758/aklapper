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

/**
 *
 * @param {GameBoardPropsTicTacToe} params needed to render each space and handle the color change when selected
 * @param {Row} GameBoardPropsTicTacToe.row - The row data for the grid.
 * @param {number} GameBoardPropsTicTacToe.columns - The number of columns in the grid.
 * @param {boolean | undefined} GameBoardPropsTicTacToe.container - Whether the grid should be a container.
 * @param {'row' | 'column' | 'row-reverse' | 'column-reverse' | undefined} GameBoardPropsTicTacToe.direction - The flex direction of the grid.
 * @param {'wrap' | 'nowrap' | undefined} GameBoardPropsTicTacToe.wrap - The flex wrap behavior of the grid.
 * @param {SxProps} [GameBoardPropsTicTacToe.gridSx] - Optional styling properties for the grid container.
 * @param {SxProps} [GameBoardPropsTicTacToe.rowSx] - Optional styling properties for the grid rows.
 * @param {string} [GameBoardPropsTicTacToe.id] - Optional ID for the grid container.
 * @param {string | undefined} GameBoardPropsTicTacToe.state - The current state of the grid.
 * @param {Dispatch<SetStateAction<string | undefined>>} GameBoardPropsTicTacToe.setStateAction - A function to update the grid's state.
 * @returns Renderable list of spaces for tic tac toe board
 */

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
