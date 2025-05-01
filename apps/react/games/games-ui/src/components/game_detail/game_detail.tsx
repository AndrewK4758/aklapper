import { RenderList, Text } from '@aklapper/react-shared';
import type { GameInstanceLobbyData, IBuiltGame, IPlayerClientData } from '@aklapper/types';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';

export interface GameDetailProps {
  game: IBuiltGame;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedGame: Dispatch<SetStateAction<IBuiltGame | null>>;
  activeGames: GameInstanceLobbyData[];
}

export default function GameDetail({ game, setOpen, setSelectedGame, activeGames }: GameDetailProps) {
  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const title = game.name;
  const icon = `/icons/${game.name.replace(/ /g, '-').toLowerCase()}-icon.svg`;
  return (
    <Grid component={'div'} key={`${title}-wrapper`} flex={1} height={'fit-content'}>
      <Card
        component={'div'}
        key={title}
        sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: '100%' }}
      >
        <CardActionArea
          id={`${title}-clickable-header`}
          onClick={() => handleOpenGame(game, setOpen, setSelectedGame)}
          sx={{}}
        >
          <CardHeader
            avatar={<Avatar src={icon} />}
            title={title}
            subheader={
              game.players.min === game.players.max
                ? `Players: ${game.players.min}`
                : `Players: ${game.players.min}-${game.players.max}`
            }
            slotProps={{
              title: { variant: 'h3' },
              subheader: { variant: 'body1' },
              avatar: {},
            }}
            sx={{ alignItems: 'flex-start' }}
          />
        </CardActionArea>
        <CardContent sx={{ padding: 1, maxHeight: 'fit-content' }}>
          <Text
            titleVariant='h6'
            titleText='Active Games'
            component={'p'}
            TypogrpahyProps={{ color: 'info' }}
            sx={{ textAlign: 'left', fontFamily: 'monospace' }}
          />
          <RenderList<GameInstanceLobbyData>
            data={activeGames}
            listMapCallback={(e, i, arr) => activeGamesCallback(e, i, arr, game, socket, activePlayer)}
          />
        </CardContent>

        <CardActions
          sx={{
            padding: 2,
            justifySelf: 'flex-end',
            width: '100%',
            display: 'inline-flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            size='small'
            variant='outlined'
            sx={{ fontSize: '1rem' }}
            onClick={() => handleOpenGame(game, setOpen, setSelectedGame)}
          >
            Game Details
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );
}

const activeGamesCallback = (
  instance: GameInstanceLobbyData,
  i: number,
  _arr: GameInstanceLobbyData[],
  game: IBuiltGame,
  socket: Socket,
  activePlayer: IPlayerClientData,
) => {
  return instance.gameName === game.name ? (
    <ListItem
      key={`${game.name}-${i}-list-item`}
      sx={{ display: 'flex', flexDirection: 'column', fontSize: '0.5rem', flex: 1 }}
    >
      <Box
        key={`${game.name}-${instance.gameInstanceID}-wrapper`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: '0.90rem',
          p: 0,
          m: 0,
        }}
      >
        <ListItemText
          key={`${game.name}-text`}
          primary={
            <Text
              key={`${instance.gameInstanceID}-players-${game.name}`}
              titleText={instance.gameInstanceID}
              component={'span'}
              titleVariant='body2'
            />
          }
          secondary={
            <>
              {instance.playersArray.map(p => (
                <Box key={`${p.id}-player-in-array-box`} sx={{ paddingY: 0.1 }}>
                  <Text key={`${p.id}-player-in-array`} titleText={p.name} titleVariant='caption' component={'span'} />
                </Box>
              ))}
            </>
          }
          slotProps={{ primary: { variant: 'h6', sx: { fontSize: 'inherit' } }, secondary: { component: 'span' } }}
        />
        <input readOnly type='text' id={`hidden-${instance.gameInstanceID}`} hidden value={instance.gameInstanceID} />
        <Button
          key={`${game.name}-${instance.gameInstanceID}-button`}
          variant='outlined'
          name={game.name}
          type='submit'
          onClick={() => {
            const idToJoin = document.getElementById(`hidden-${instance.gameInstanceID}`) as HTMLInputElement;
            socket.emit('join-game', { gameId: idToJoin.value, playerData: activePlayer });
          }}
          sx={{ p: 0, fontSize: 'inherit' }}
        >
          Join
        </Button>
      </Box>
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
