import { ImageLink, RenderList } from '@aklapper/react-shared';
import { IBuiltGame } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { lazy, useState, type Dispatch, type SetStateAction } from 'react';
import { useRouteLoaderData } from 'react-router';
import { GamesTheme as Theme } from '../styles/games-theme';

const GameDetails = lazy(() => import('./game_details'));

const GamesList = () => {
  const games = useRouteLoaderData('gameList') as IBuiltGame[];
  const [open, setOpen] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<IBuiltGame | null>(null);

  const listGamesMap = (
    e: IBuiltGame,
    _i: number,
    _arr: IBuiltGame[],
    setOpen: Dispatch<SetStateAction<boolean>>,
    setSelectedGame: Dispatch<SetStateAction<IBuiltGame | null>>
  ) => (
    <ImageLink
      game={e}
      key={e.id}
      id={e.name}
      srcSet={`/images/${e.imageURL}`}
      loading="lazy"
      alt={`${e.name}-game-picture`}
      style={{ borderRadius: '4px', width: '200px', height: 'auto' }}
      icon={`/icons/${e.name.replace(/ /g, '-').toLowerCase()}-icon.svg`}
      title={e.name}
      subtitle={e.id}
      setOpen={setOpen}
      setSelectedGame={setSelectedGame}
      breakpointsImageListText={{
        backgroundColor: Theme.palette.background.paper,
        borderRadius: 1,
        color: Theme.palette.secondary.main
      }}
    />
  );

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifySelf: 'center',
          width: '100%'
        }}
      >
        <Container
          component={'div'}
          sx={{
            paddingY: 2
          }}
        >
          <RenderList
            component={'ul'}
            listMapCallback={(e, i, arr) =>
              listGamesMap(e as IBuiltGame, i, arr as IBuiltGame[], setOpen, setSelectedGame)
            }
            sx={{
              display: 'flex',
              justifyContent: 'space-evenly',
              gap: 4
            }}
            data={games}
          />
        </Container>
      </Box>
      <GameDetails open={open} setOpen={setOpen} selectedGame={selectedGame} />
    </>
  );
};

export default GamesList;
