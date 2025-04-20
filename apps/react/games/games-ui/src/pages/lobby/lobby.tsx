import { RenderList, Text } from '@aklapper/react-shared';
import type {
  ClientLobbyData,
  GameInsanceLobbyData,
  // GamesInLobbyPending,
  IPlayerClientData,
  NewGameDetails,
  PrivateMessageDetails,
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
    if (!socket.connected) {
      socket.connect();

      socket.on('connect', () => {
        console.log(`Websocket Connected to path: /lobby with id: ${socket.id}`);
        setActivePlayer(() => ({ ...activePlayer, websocketId: socket.id }));
      });

      socket.emit('enter-lobby', activePlayer);

      socket.on('new-player', (data: IPlayerClientData) => {
        setActiveLobby(prev => {
          const exists = prev.find(p => p.id === data.id);

          if (exists) return [...prev];
          else return [...prev, data];
        });
      });

      socket.on('private-message', (message: PrivateMessageDetails) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('remove-player', id => {
        setActiveLobby(activeLobby.filter(player => player.id === id));
      });

      socket.on('new-game', ({ newGameId, gamesInLobby }: NewGameDetails) => {
        setActivePlayer(() => ({ ...activePlayer, activenewGameId: newGameId }));
        setActiveGames(gamesInLobby);
      });
    }
    return () => {
      if (socket.connected) {
        removeFromLobby();
        socket.emit('remove-player', activePlayer.id);
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, []);

  return (
    <WebsocketContextProvider>
      <Box component={'div'} id='lobby-wrapper' height={'100%'}>
        <Box component={'section'} id='lobby-title' textAlign={'center'}>
          <Text titleText='Game Lobby' titleVariant='h1' component={'h1'} />
        </Box>

        <Box component={'section'} id='lobby-header-wrapper' display={'flex'} alignItems={'flex-end'}>
          <Box component={'section'} id='players-in-lobby-wrapper' flex={1}>
            <Text titleText={'Active Players'} titleVariant='h2' component={'h2'} />
            <Divider />
          </Box>
          <Box component={'section'} id='game-list-title-wrapper' flex={2.5}>
            <Text component={'h2'} titleVariant='h2' titleText={'Games'} />
            <Divider />
          </Box>
          <Box component={'section'} id='lobby-messages-wrapper' flex={1.5}>
            <Text titleText='Messages' titleVariant='h2' component={'h2'} />
            <Divider />
          </Box>
        </Box>

        <Box component={'section'} id='lobby-data-wrapper' display={'flex'} height={'80vh'} minHeight={'fit-content'}>
          <Box component={'section'} id='players-in-lobby-list-wrapper' sx={{ flex: 1 }}>
            <RenderList<IPlayerClientData>
              data={activeLobby}
              listMapCallback={(e, i, arr) =>
                playersMapCallback(e, i, arr, activePlayer, setOpenMessage, setMessageTarget)
              }
            />
          </Box>
          <Divider orientation='vertical' />
          <Box component={'section'} id='active-games-not-starte  d-wrapper' flex={2.5}>
            <GamesList activeGames={activeGames} />
          </Box>
          <Divider textAlign='left' orientation='vertical' />

          <Box component={'section'} id='lobby-messages' flex={1.5}>
            {messages.map(messagesListCallback)}
          </Box>
        </Box>

        <Button
          onClick={() => {
            nav('/', { replace: true });
          }}
        >
          Leave Lobby
        </Button>
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
      <Box component={'section'} border={0} flex={1} textAlign={'right'}>
        <Text
          component={'span'}
          titleText={sender.senderName}
          titleVariant={'body2'}
          key={`${sender.senderName}-${message}`}
          sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
        />
      </Box>
      <Box component={'section'} border={0} flex={5} textAlign={'right'}>
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
