import type { GamesInLobbyToSend, IBuiltGame } from '@aklapper/types';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import type { Dispatch, SetStateAction } from 'react';
import RenderList from '../render-list/render-list';
import Text from '../text/text';

export interface GameDetailProps {
  game: IBuiltGame;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedGame: Dispatch<SetStateAction<IBuiltGame | null>>;
  activeGames: GamesInLobbyToSend[];
}

export function GameDetail({ game, setOpen, setSelectedGame, activeGames }: GameDetailProps) {
  const title = game.name;
  const icon = `/icons/${game.name.replace(/ /g, '-').toLowerCase()}-icon.svg`;

  return (
    <Grid component={'div'} key={`${title}-wrapper`} flex={1} height={'50%'}>
      <Card
        component={'div'}
        key={title}
        sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
      >
        <CardActionArea id={`${title}-clickable-header`} onClick={() => handleOpenGame(game, setOpen, setSelectedGame)}>
          <CardHeader
            avatar={<Avatar src={icon} />}
            title={title}
            subheader={
              game.players.min === game.players.max
                ? `Players: ${game.players.min}`
                : `Players: ${game.players.min}-${game.players.max}`
            }
            slotProps={{
              title: { fontSize: '2.2rem', color: 'primary' },
              subheader: { color: 'textPrimary' },
              avatar: { sx: { m: 0.2 } },
            }}
            sx={{ p: 1, alignItems: 'flex-start', flex: 2 }}
          />
        </CardActionArea>
        <CardContent sx={{ padding: 1, flex: 1, maxHeight: 'fit-content' }}>
          <Text
            titleVariant='subtitle1'
            titleText='Active Games'
            component={'p'}
            TypogrpahyProps={{ color: 'info' }}
            sx={{ textAlign: 'left' }}
          />
          <RenderList<GamesInLobbyToSend>
            data={activeGames}
            listMapCallback={(e: GamesInLobbyToSend, i, arr) => activeGamesCallback(e, i, arr, game)}
          />
        </CardContent>

        <CardActions sx={{ alignSelf: 'flex-end', textAlign: 'right', padding: 2 }}>
          <Button
            size='small'
            variant='outlined'
            sx={{ fontSize: '.5rem' }}
            onClick={() => handleOpenGame(game, setOpen, setSelectedGame)}
          >
            Game Details
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );
}

const activeGamesCallback = (e: GamesInLobbyToSend, _i: number, _arr: GamesInLobbyToSend[], game: IBuiltGame) => {
  return Object.hasOwn(e, game.name) ? (
    <ListItem
      key={`${game.name}-list-item`}
      sx={{ display: 'flex', flexDirection: 'column', fontSize: '0.5rem', flex: 1 }}
    >
      {e[game.name].map(id => (
        <ListItemText
          key={`${game.name}-${id}-text`}
          primary={id}
          // secondary={<CardActions>{'Join'}</CardActions>}
        />
      ))}
    </ListItem>
  ) : null;
};

const handleOpenGame = function (
  game: IBuiltGame | null,
  setOpen: Dispatch<SetStateAction<boolean>>,
  setSelectedGame: Dispatch<SetStateAction<IBuiltGame | null>>,
): void {
  setSelectedGame(game);
  setOpen(true);
};
