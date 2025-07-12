import type { GameBoards } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import Row from './row';

interface ShowGameBoardProps {
  board: GameBoards;
}

/**
 *
 * @returns a rendered game board
 */
const GameBoard = function ({ board }: ShowGameBoardProps) {
  return (
    <Box as={'section'} id='game-board-wrapper' className={css({ width: '100%', flex: '0 1 95%' })}>
      {board.map((row, idx) => (
        <Row key={`chutes-&-ladders-row-${idx}`} row={row} id={`Row ${idx}`} />
      ))}
    </Box>
  );
};

export default GameBoard;
