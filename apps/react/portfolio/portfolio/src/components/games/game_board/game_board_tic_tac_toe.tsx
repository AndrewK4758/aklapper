import type { GameBoards } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import RowTicTacToe from './row-tic-tac-toe';

export interface GameBoardPropsTicTacToe {
  board: GameBoards;
  id?: string | number;
  state: string | undefined;
  setStateAction: (space: string) => void;
}

export default function GameBoardTicTacToe({ board, id, state, setStateAction }: GameBoardPropsTicTacToe) {
  return (
    <Box as={'section'} id={`row-${id}`} sx={{ flex: '0 1 95%', display: 'flex', flexDirection: 'column' }}>
      {board.map((row, idx) => (
        <RowTicTacToe key={`row-${idx}`} row={row} id={`row-${idx}`} state={state} setStateAction={setStateAction} />
      ))}
    </Box>
  );
}
