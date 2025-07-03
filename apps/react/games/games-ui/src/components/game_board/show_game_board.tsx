import { RenderList } from '@aklapper/react-shared';
import type { GameBoards, ILiteSpace } from '@aklapper/types';
import GameBoardMap from './game-boards/game-board';

const gameBoardMap = (e: ILiteSpace[], i: number, _arr: GameBoards) => (
  <GameBoardMap key={`row-${i}`} row={e} columns={10} container={true} direction='row' wrap='wrap' id={`Row ${i}`} />
);

interface ShowGameBoardProps {
  board: GameBoards;
}

/**
 *
 * @returns a rendered game board
 */
const ShowGameBoard = ({ board }: ShowGameBoardProps) => <RenderList data={board} listMapCallback={gameBoardMap} />;

export default ShowGameBoard;
