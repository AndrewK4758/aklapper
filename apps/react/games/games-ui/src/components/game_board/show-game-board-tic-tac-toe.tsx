import type { GameBoards, Row } from '@aklapper/types';
import Box from '@mui/material/Box';
import type { SxProps } from '@mui/material/styles';
import { Fragment, type Dispatch, type JSX, type SetStateAction } from 'react';
import { GamesTheme as Theme } from '../../styles/games-theme';
import GameBoardMapTicTacToe from './game-boards/game-board-tic-tac-toe';

const breakpointsGameBoardBox: SxProps = {
  border: `5px solid ${Theme.palette.success.main}`,
  [Theme.breakpoints.up('md')]: {
    boxShadow: `0px 7px 8px -4px ${Theme.palette.success.main}, 0px 12px 17px 2px ${Theme.palette.primary.light}, 0px 5px 22px 4px ${Theme.palette.primary.dark}, 0px -7px 8px -4px ${Theme.palette.success.main}, 0px -12px 17px 2px ${Theme.palette.primary.light}, 0px -5px 22px 4px ${Theme.palette.primary.dark}`,
  },
};

interface ShowGameBoardProps {
  board: GameBoards;
  state: string | undefined;
  setStateAction: Dispatch<SetStateAction<string | undefined>>;
}

/**
 *
 * @returns a rendered game board
 */

const ShowGameBoardTicTacToe = ({ board, state, setStateAction }: ShowGameBoardProps) => {
  return (
    <Box component={'section'} sx={breakpointsGameBoardBox}>
      {board.map((e: Row, i: number): JSX.Element => {
        return (
          <Fragment key={Math.random().toFixed(4)}>
            <GameBoardMapTicTacToe
              row={e}
              columns={3}
              container={true}
              direction='row'
              wrap='wrap'
              id={`Row ${i}`}
              state={state}
              setStateAction={setStateAction}
            />
          </Fragment>
        );
      })}
    </Box>
  );
};

export default ShowGameBoardTicTacToe;
