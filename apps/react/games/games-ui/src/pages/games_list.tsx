import { ImageLink, RenderList, Text } from '@aklapper/react-shared';
import { IBuiltGame } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { SxProps } from '@mui/material/styles';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { useRouteLoaderData } from 'react-router';
import GamesTheme, { GamesTheme as Theme } from '../styles/games-theme';
import GameDetails from './game_details';

const breakpointsGameListText: SxProps = {
  width: '100%',
  borderBottom: 2,
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem'
  }
};

// const breakpointsImageListText: SxProps = {
//   fontSize: '12px',
//   [Theme.breakpoints.down('md')]: {
//     '& .MuiImageListItemBar-title': {
// fontSize: '1.5rem';
//     }
//   }
// };

const GamesList = () => {
  const games = useRouteLoaderData('gameList') as IBuiltGame[];
  const [open, setOpen] = useState<boolean>(false);
  // const media = useMediaQuery(Theme.breakpoints.up('md'));

  const listGamesMap = (e: IBuiltGame, _i: number, _arr: IBuiltGame[], setOpen: Dispatch<SetStateAction<boolean>>) => (
    <ImageLink
      key={e.id}
      type="a"
      to={`${e.name.replace(/ /g, '-')}`}
      id={e.name}
      srcSet={`./images/${e.imageURL}`}
      loading="lazy"
      alt={`${e.name}-game-picture`}
      style={{ borderRadius: '4px' }}
      title={e.name}
      setOpen={setOpen}
      breakpointsImageListText={{
        backgroundColor: GamesTheme.palette.background.paper,
        borderRadius: 1,
        color: GamesTheme.palette.secondary.main
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
        <Box component={'section'} id="game-list-title-wrapper" sx={{ width: '100%' }}>
          <Text component={'h2'} titleVariant="h2" titleText={'Games'} sx={breakpointsGameListText} />
        </Box>

        <Container
          component={'div'}
          sx={{
            paddingY: 2
          }}
        >
          <RenderList
            component={'ul'}
            listMapCallback={(e, i, arr) => listGamesMap(e as IBuiltGame, i, arr as IBuiltGame[], setOpen)}
            sx={{
              m: 0,
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 5
            }}
            data={games}
          />
        </Container>
      </Box>
      <GameDetails open={open} setOpen={setOpen} />
    </>
  );
};

export default GamesList;

//
