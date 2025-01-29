import { RenderList } from '@aklapper/react-shared';
import { GameBoard, ILiteSpace } from '@aklapper/types';
import Box from '@mui/material/Box';
import { breakpointsGameBoardBox } from '../../../styles/games-styles';
import GameBoardMap from '../game-boards/game-board';

/**
 *
 * @param e ILiteSpace array or a ROW
 * @param i index of space in row
 * @param _arr ROW array of spaces
 * @returns built ui GameBoard
 */

const gameBoardMap = (e: ILiteSpace[], i: number, _arr: GameBoard) => (
  <GameBoardMap
    key={`chutes-&-ladders-row-${i}`}
    row={e}
    columns={10}
    container={true}
    direction="row"
    wrap="wrap"
    id={`Row ${i}`}
    rowSx={{ flex: '1 0 100%' }}
  />
);

interface ShowGameBoardProps {
  board: GameBoard;
}

/**
 *
 * @returns a rendered game board
 */
const ShowGameBoard = ({ board }: ShowGameBoardProps) => (
  <Box key={`game-board-length-${board.length}`} component={'section'} sx={breakpointsGameBoardBox}>
    <RenderList data={board} listMapCallback={gameBoardMap} sx={{ flex: '1 0 100%' }} />
  </Box>
);

export default ShowGameBoard;
