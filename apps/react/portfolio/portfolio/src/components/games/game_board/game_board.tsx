import type { GameBoards } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import type { SxProp } from '@pigment-css/react';
import Row from './row.js';

const breakpointsBoardWrapper: SxProp = { width: '100%', flex: '0 1 95%' };

interface ShowGameBoardProps {
  board: GameBoards;
}

/**
 *
 * @returns a rendered game board
 */
export default function GameBoard({ board }: ShowGameBoardProps) {
  return (
    <Box as={'section'} id='game-board-wrapper' sx={breakpointsBoardWrapper}>
      {board.map((row, idx) => (
        <Row key={`chutes-&-ladders-row-${idx}`} row={row} id={`Row ${idx}`} />
      ))}
    </Box>
  );
}
