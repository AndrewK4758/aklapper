import { RenderList, Text } from '@aklapper/react-shared';
import type {
  ClientLobbyData,
  GameInsanceLobbyData,
  IPlayerClientData,
  PlayerID,
  PrivateMessageDetails,
  WsLobbyEventData,
} from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import { useContext, useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';
import PrivateMessageModal from '../../components/messages/private_message';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';
import WebsocketContextProvider from '../../context/websocket_context_provider';
import GamesList from '../games_list';

// Components of lobby
// X Active players in lobby
// - Active games looking for players
// - Join game functionality (mouse or keyboard)
// - pub/sub & we bsocket event handling and emitting
// X Emit event when player enters lobby
// X Emit event when game is created to inLobby players not in game
// X Emit event when player leaves lobby
// X Mesaging between players
// -- Remove players from lobby if in active game
// X- Create closed messaging group for players in active game
// --- Create websocket namespace or path for each active game ID and connect players on join

// X Emit event when game is created to inLobby players not in game
// X Remove navigation to :id/register route when game is created
// X On succesful response code for registering game, display active game in UI by emit event to all players
//      with ability to join game
// ---- All active games will have ability for player to join with button
// ---- Game will automatically emit event once max players reached and remove ability to connect with game from ui
// ---- Redirect game with players to avatar registration page according to game

export default function Lobby() {
  const { activeGamesInLobby, activePlayersInLobby } = useRouteLoaderData('lobby') as ClientLobbyData;
  const { activePlayer, setActivePlayer, removeFromLobby } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);

  const [activeLobby, setActiveLobby] = useState<IPlayerClientData[]>(activePlayersInLobby);
  const [messages, setMessages] = useState<PrivateMessageDetails[]>([]);
  const [openMessage, setOpenMessage] = useState<boolean>(false);
  const [messageTarget, setMessageTarget] = useState<PrivateMessageDetails | null>(null);
  const [activeGames, setActiveGames] = useState<GameInsanceLobbyData[]>(activeGamesInLobby);

  const nav = useNavigate();

  useEffect(() => {
    if (!socket.connected && activePlayer.name) {
      socket.connect();

      socket.on('connect', () => {
        console.log(`Websocket Connected to path: /lobby with id: ${socket.id}`);
        activePlayer.socketIoId = socket.id;

        setActivePlayer({ ...activePlayer });
      });

      socket.emit('enter-lobby', activePlayer);

      socket.on('new-player', (newPlayer: IPlayerClientData) => {
        setActiveLobby(prevLobby => {
          const playerExists = prevLobby.find(p => p.id === newPlayer.id);

          if (playerExists) return [...prevLobby];
          else return [...prevLobby, newPlayer];
        });
      });

      socket.on('private-message', (message: PrivateMessageDetails) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('deleted-player', (playerId: PlayerID) => {
        setActiveLobby(prevLobby => {
          return [...prevLobby.filter(p => p.id !== playerId)];
        });
      });

      socket.on('new-game', ({ newGameId, gamesInLobby }: WsLobbyEventData) => {
        setActivePlayer(() => ({ ...activePlayer, activenewGameId: newGameId }));
        setActiveGames(gamesInLobby);
      });

      socket.on('player-added', ({ newGameId, gamesInLobby }: WsLobbyEventData) => {
        activePlayer.activeGameID = newGameId;
        setActivePlayer({ ...activePlayer });
        setActiveGames(gamesInLobby);
      });

      socket.on('player-joined', ({ gameId, newLobby, newPlayer }) => {
        console.log('joined event');
        console.log(newLobby);
        const gameToUpdate = activeGames.find(game => game.gameInstanceID === gameId);
        if (gameToUpdate) {
          gameToUpdate.playersArray.push(newPlayer);
          setActiveGames(prev => [...prev]);
        } else setActiveGames(activeGames);
      });
    }
    return () => {
      if (socket.connected) {
        socket.emit('remove-player', activePlayer.id);
        removeFromLobby();
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, []);

  return (
    <WebsocketContextProvider key={'lobby-websocket-provider'}>
      <Box component={'div'} key={'lobby'} id='lobby-wrapper' flex={1} display={'flex'} flexDirection={'column'}>
        <Box component={'section'} id='lobby-header-wrapper' display={'flex'} flexGrow={0} alignItems={'flex-end'}>
          <Box component={'section'} id='players-in-lobby-wrapper' flex={1} textAlign={'center'}>
            <Text titleText={'Active Players'} titleVariant='h2' component={'h2'} />
            <Divider />
          </Box>
          <Box component={'section'} id='game-list-title-wrapper' flex={2.5} textAlign={'center'}>
            <Text component={'h2'} titleVariant='h2' titleText={'Games'} />
            <Divider />
          </Box>
          <Box component={'section'} id='lobby-messages-wrapper' flex={1.5} textAlign={'center'}>
            <Text titleText='Messages' titleVariant='h2' component={'h2'} />
            <Divider />
          </Box>
        </Box>

        <Box component={'section'} id='lobby-data-wrapper' display={'flex'} flex={1} minHeight={'fit-content'}>
          <Box component={'section'} id='players-in-lobby-list-wrapper' sx={{ flex: 1 }}>
            <RenderList<IPlayerClientData>
              data={activeLobby}
              listMapCallback={(e, i, arr) =>
                playersMapCallback(e, i, arr, activePlayer, setOpenMessage, setMessageTarget)
              }
            />
          </Box>
          <Divider orientation='vertical' flexItem />
          <Box
            component={'section'}
            id='active-games-not-started-wrapper'
            flex={2.5}
            sx={{ display: 'flex', flexDirection: 'column' }}
          >
            <GamesList activeGames={activeGames} />
            <Box sx={{ alignSelf: 'flex-end', display: 'flex', paddingRight: 2 }}>
              <Button
                onClick={() => {
                  nav('/', { replace: true });
                }}
              >
                Leave Lobby
              </Button>
            </Box>
          </Box>
          <Divider textAlign='left' orientation='vertical' flexItem />

          <Box component={'section'} id='lobby-messages' flex={1.5}>
            {messages.map(messagesListCallback)}
          </Box>
        </Box>
      </Box>
      <PrivateMessageModal
        open={openMessage}
        setOpen={setOpenMessage}
        messageTarget={messageTarget}
        setMessages={setMessages}
      />
    </WebsocketContextProvider>
  );
}

function playersMapCallback(
  e: IPlayerClientData,
  _i: number,
  _arr: IPlayerClientData[],
  currentPlayer: Partial<IPlayerClientData>,
  setOpenMessage: Dispatch<SetStateAction<boolean>>,
  setMessageTarget: Dispatch<SetStateAction<PrivateMessageDetails | null>>,
): ReactElement {
  const { name, id } = e;

  return (
    <Box
      component={'section'}
      id={`active-player-${name}-${id}-wrapper`}
      key={`active-player-${name}-${id}-wrapper`}
      sx={{ borderBottom: 2, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}
    >
      <Text key={`${name}-${id}`} titleText={name} titleVariant='body1' component={'p'} sx={{}} />
      {id !== currentPlayer.id && (
        <Button
          LinkComponent={'button'}
          variant='outlined'
          name={name}
          id={`message-player-${id}-button`}
          size='small'
          onClick={() =>
            handleMessageClick(
              {
                sender: {
                  senderName: currentPlayer.name as string,
                  senderId: currentPlayer.id as string,
                },
                target: {
                  targetName: name as string,
                  targetId: id as string,
                },
                message: '',
              },
              setOpenMessage,
              setMessageTarget,
            )
          }
          sx={{ fontSize: '1rem' }}
        >
          Message
        </Button>
      )}
    </Box>
  );
}

async function handleMessageClick(
  messageDetails: PrivateMessageDetails,
  setOpenMessage: Dispatch<SetStateAction<boolean>>,
  setMessageTarget: Dispatch<SetStateAction<PrivateMessageDetails | null>>,
) {
  setOpenMessage(true);
  setMessageTarget(messageDetails);
}

function messagesListCallback({ message, target, sender }: PrivateMessageDetails) {
  return (
    <Container
      component={'section'}
      id={`${target.targetId}-${message}-wrapper`}
      key={`${message}-wrapper`}
      sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderBottom: 2 }}
    >
      <Box component={'section'} flex={1} textAlign={'right'}>
        <Text
          component={'span'}
          titleText={sender.senderName}
          titleVariant={'body2'}
          key={`${sender.senderName}-${message}`}
          sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
        />
      </Box>
      <Box component={'section'} flex={5} textAlign={'right'}>
        <Text
          component={'span'}
          titleVariant={'subtitle1'}
          key={`${message}`}
          titleText={message}
          sx={{ fontFamily: 'monospace' }}
        />
      </Box>
    </Container>
  );
}
