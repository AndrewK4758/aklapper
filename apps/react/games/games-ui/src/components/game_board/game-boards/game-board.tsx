import { RenderList, Text } from '@aklapper/react-shared';
import { ILiteSpace } from '@aklapper/types';
import { SxProps } from '@mui/material';
import Grid from '@mui/material/Grid';
import { avatarSize, breakpointsRowSx, breakpointsSpaceSx, spaceStyle } from '../../../styles/game-board-styles';

export interface GameBoardProps {
  row: ILiteSpace[];
  columns: number;
  container: boolean | undefined;
  direction: 'row' | 'column' | 'row-reverse' | 'column-reverse' | undefined;
  wrap: 'wrap' | 'nowrap' | undefined;
  id: string | undefined;
  gridSx?: SxProps;
  rowSx?: SxProps;
}

/**
 *
 * @param e ILiteSpace
 * @param _i index of space
 * @param _arr array of spaces
 * @returns each space for provided row
 */

const gameBoardRowMap = (e: ILiteSpace, i: number, _arr: string[]) => (
  <Grid key={`space-${i}-${e.display}`} sx={breakpointsRowSx}>
    {e.display.endsWith('.svg') ? (
      <img
        key={`${e.display}-avatar-c&l`}
        id={`${e.display}-avatar-c&l`}
        data-testid={`${e.display}-avatar-c&l`}
        src={`/game-avatars/${e.display}`}
        alt={`${e.display} game piece`}
        style={avatarSize}
      />
    ) : (
      <Text
        component={'p'}
        key={`${e.display}-space-text-c&l`}
        id={`${e.display}-space-text-c&l`}
        data-testid={`${e.display}-space-text-c&l`}
        titleVariant="body2"
        titleText={e.display}
        sx={breakpointsSpaceSx}
      />
    )}
  </Grid>
);

export const GameBoardMap = ({ row, columns, container, direction, wrap, id, rowSx }: GameBoardProps) => (
  <Grid
    key={`row-${row}-${columns}`}
    columns={columns}
    container={container}
    direction={direction}
    wrap={wrap}
    id={id}
    sx={rowSx}
  >
    <RenderList component={'section'} data={row} listMapCallback={gameBoardRowMap} sx={spaceStyle} />
  </Grid>
);

export default GameBoardMap;
