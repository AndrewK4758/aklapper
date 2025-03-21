import { RenderList } from '@aklapper/react-shared';
import { GameBoard, ILiteSpace } from '@aklapper/types';
import { SxProps } from '@mui/material';
import Box from '@mui/material/Box';
import { GamesTheme as Theme } from '../../styles/games-theme';
import GameBoardMap from './game-boards/game-board';

const breakpointsGameBoardBox: SxProps = {
  border: `5px solid ${Theme.palette.success.main}`,
  [Theme.breakpoints.up('md')]: {
    boxShadow: `0px 7px 8px -4px ${Theme.palette.success.main}, 0px 12px 17px 2px ${Theme.palette.primary.light}, 0px 5px 22px 4px ${Theme.palette.primary.dark}, 0px -7px 8px -4px ${Theme.palette.success.main}, 0px -12px 17px 2px ${Theme.palette.primary.light}, 0px -5px 22px 4px ${Theme.palette.primary.dark}`
  }
};

const gameBoardMap = (e: ILiteSpace[], i: number, _arr: GameBoard) => (
  <GameBoardMap row={e} columns={10} container={true} direction="row" wrap="wrap" id={`Row ${i}`} />
);

interface ShowGameBoardProps {
  board: GameBoard;
}

/**
 *
 * @returns a rendered game board
 */
const ShowGameBoard = ({ board }: ShowGameBoardProps) => (
  <Box component={'section'} sx={breakpointsGameBoardBox}>
    {board && <RenderList component={'section'} data={board} listMapCallback={gameBoardMap} />}
  </Box>
);

export default ShowGameBoard;
