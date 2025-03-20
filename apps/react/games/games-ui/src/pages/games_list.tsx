import { RenderList, Text } from '@aklapper/react-shared';
import { IBuiltGame } from '@aklapper/types';
import { SxProps, useMediaQuery } from '@mui/material';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import ImageList from '@mui/material/ImageList';
import { useRouteLoaderData } from 'react-router';
import ImageLink from '../components/image-link/image-link';
import { GamesTheme as Theme } from '../styles/games-theme';

const breakpointsGameListText: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem'
  }
};

const breakpointsImageListText: SxProps = {
  fontSize: '12px',
  [Theme.breakpoints.down('md')]: {
    '& .MuiImageListItemBar-title': {
      fontSize: '1.5rem'
    }
  }
};

const GamesList = () => {
  const games = useRouteLoaderData('gameList') as IBuiltGame[];
  const media = useMediaQuery(Theme.breakpoints.up('md'));

  const listGamesMap = (e: IBuiltGame, _i: number, _arr: IBuiltGame[]) => (
    <ImageLink
      key={e.id}
      type="a"
      to={`${e.name.replace(/ /g, '-')}`}
      id={e.name}
      srcSet={`./images/${e.imageURL}`}
      loading="lazy"
      alt={`${e.name} game picture`}
      style={{ width: media ? '365px' : '200px', height: 'auto' }}
      title={e.name}
      position="bottom"
      breakpointsImageListText={breakpointsImageListText}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifySelf: 'center' }}>
      <Container
        component={'div'}
        sx={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyItems: 'center'
        }}
      >
        <Text component={'h1'} titleVariant="h1" titleText={'Games'} sx={breakpointsGameListText} />
      </Container>
      <Container component={'div'}>
        <ImageList
          variant="standard"
          cols={media ? 2 : 1}
          rowHeight={media ? 365 : 200}
          gap={12}
          sx={{ m: 0, display: 'flex' }}
        >
          <RenderList component={'section'} data={games} listMapCallback={listGamesMap} />
        </ImageList>
      </Container>
    </Box>
  );
};

export default GamesList;

//
