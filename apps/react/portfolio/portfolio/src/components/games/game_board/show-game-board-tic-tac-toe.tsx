import type { GameBoard } from '@aklapper/types';
import Box from '@mui/material/Box';
import type { Dispatch, JSX, SetStateAction } from 'react';
import { breakpointsGameBoardBoxTicTacToe } from '../../../styles/games-styles.jsx';
import GameBoardMapTicTacToe from '../game-boards/game-board-tic-tac-toe.jsx';

interface ShowGameBoardProps {
  board: GameBoard;
  state: string | undefined;
  setStateAction: Dispatch<SetStateAction<string | undefined>>;
}

/**
 * This component renders a Tic Tac Toe game board.
 *
 * @param {ShowGameBoardProps} props - The props for the ShowGameBoardTicTacToe component.
 * @param {GameBoard} props.board - The game board data.
 * @param {string | undefined} props.state - The currently selected space on the board.
 * @param {Dispatch<SetStateAction<string | undefined>>} props.setStateAction - A function to update the selected space.
 * @returns {JSX.Element} The rendered ShowGameBoardTicTacToe component.
 */

const ShowGameBoardTicTacToe = ({ board, state, setStateAction }: ShowGameBoardProps): JSX.Element => (
  <Box
    key={'tic-tac-toe-whole-board'}
    id={'tic-tac-toe-whole-board'}
    component={'section'}
    sx={breakpointsGameBoardBoxTicTacToe}
  >
    {board.map(
      (e, i, _arr): JSX.Element => (
        <GameBoardMapTicTacToe
          key={`${i}-row-ttt`}
          row={e}
          columns={3}
          id={`row-${i}`}
          container={true}
          direction="row"
          wrap="wrap"
          state={state}
          setStateAction={setStateAction}
        />
      )
    )}
  </Box>
);

export default ShowGameBoardTicTacToe;
