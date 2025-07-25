import { Text } from '@aklapper/react-shared';
import type { ILiteSpace, Row } from '@aklapper/types';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import type { SxProps } from '@mui/material/styles';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import {
  avatarTTTSize,
  breakpointsRowTTTSx,
  breakpointsSpaceTTTSx,
  nonSelectedSpaceStyle,
  rowSizeTTT,
  selectedSpaceStyle,
  svgSpaceTTTStyles,
} from '../../../styles/game-board-styles';

export interface GameBoardPropsTicTacToe {
  row: Row;
  columns: number;
  container: boolean | undefined;
  direction: 'row' | 'column' | 'row-reverse' | 'column-reverse' | undefined;
  wrap: 'wrap' | 'nowrap' | undefined;
  gridSx?: SxProps;
  rowSx?: SxProps;
  id?: string;
  state: string | undefined;
  setStateAction: Dispatch<SetStateAction<string | undefined>>;
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

export const GameBoardMapTicTacToe = ({
  row,
  columns,
  container,
  direction,
  id,
  wrap,
  state,
  setStateAction,
}: GameBoardPropsTicTacToe) => (
  <Grid
    component={'section'}
    columns={columns}
    container={container}
    direction={direction}
    wrap={wrap}
    id={`row-${id}`}
    sx={rowSizeTTT}
  >
    {row.map((e: ILiteSpace, i: number, _arr: ILiteSpace[]) => (
      <Grid
        key={`space-${e.display}-${i}`}
        id={`space-${e.display}-${i}`}
        component={'div'}
        sx={setStyleOnState(state, e.display, breakpointsRowTTTSx, selectedSpaceStyle, nonSelectedSpaceStyle)}
        onClick={(e: MouseEvent<HTMLDivElement>) => setStateAction(e.currentTarget.textContent as string)}
      >
        {e.display.indexOf('g') === e.display.length - 1 ? (
          <Box
            key={`${e.display}-svg-wrapper-space-${i}`}
            id={`${e.display}-svg-wrapper-space-${i}`}
            data-testid={`${e.display}-svg-wrapper-space-${i}`}
            sx={svgSpaceTTTStyles}
          >
            <img
              key={`${e.display}-avatar-${i}`}
              src={`/game-avatars/${e.display}`}
              alt={`${e.display} game piece`}
              style={avatarTTTSize}
            />
          </Box>
        ) : (
          <Box>
            <Text
              key={`${e.display}-space`}
              id={`${e.display}-space`}
              data-testid={`${e.display}-space`}
              variant='body2'
              children={e.display}
              sx={breakpointsSpaceTTTSx}
            />
          </Box>
        )}
      </Grid>
    ))}
  </Grid>
);

export default GameBoardMapTicTacToe;

const setStyleOnState = (
  state: string | undefined,
  name: string,
  base: SxProps,
  cond1: SxProps,
  cond2: SxProps,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SxProps => (state === name ? { ...(base as any), ...cond1 } : { ...(base as any), ...cond2 });
