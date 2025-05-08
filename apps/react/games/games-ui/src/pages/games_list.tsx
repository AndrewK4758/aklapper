import { RenderList } from '@aklapper/react-shared';
import type { GameInstanceLobbyData, IBuiltGame } from '@aklapper/types';
import Grid from '@mui/material/Grid';
import type { Dispatch, SetStateAction } from 'react';
import { lazy, useState } from 'react';
import { useRouteLoaderData } from 'react-router';
import GameDetail from '../components/game_detail/game_detail';

const GameDetails = lazy(() => import('./game_details'));

interface GamesListProps {
  activeGames: GameInstanceLobbyData[];
}

const GamesList = ({ activeGames }: GamesListProps) => {
  const games = useRouteLoaderData('gameList') as IBuiltGame[];
  const [open, setOpen] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<IBuiltGame | null>(null);
  const [joinedGame, setJoinedGame] = useState<string | null>(() => {
    const savedGameId = sessionStorage.getItem('joined-game');

    return savedGameId ? (JSON.parse(savedGameId) as { joinedGameId: string }).joinedGameId : '';
  });

  return (
    <>
      <Grid
        columns={2}
        container={true}
        columnSpacing={2}
        sx={{
          p: 2,
          height: '100%',
        }}
      >
        <RenderList<IBuiltGame>
          data={games}
          listMapCallback={(e, i, arr) =>
            listGamesMap(e, i, arr, setOpen, setSelectedGame, activeGames, joinedGame, setJoinedGame)
          }
        />
      </Grid>
      <GameDetails open={open} setOpen={setOpen} selectedGame={selectedGame} />
    </>
  );
};

export default GamesList;

const listGamesMap = (
  e: IBuiltGame,
  _i: number,
  _arr: IBuiltGame[],
  setOpen: Dispatch<SetStateAction<boolean>>,
  setSelectedGame: Dispatch<SetStateAction<IBuiltGame | null>>,
  activeGames: GameInstanceLobbyData[],
  joinedGame: string | null,
  setJoinedGame: Dispatch<SetStateAction<string | null>>,
) => {
  return (
    <GameDetail
      key={`${e.id}-${e.name}`}
      game={e}
      setOpen={setOpen}
      setSelectedGame={setSelectedGame}
      activeGames={activeGames}
      joinedGame={joinedGame}
      setJoinedGame={setJoinedGame}
    />
  );
};
