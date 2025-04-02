import { Label, Text } from '@aklapper/react-shared';
import type { IPlayer, PrivateMessageDetails } from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { useContext, useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Outlet, useActionData, useNavigate, useRouteLoaderData } from 'react-router';
import ActivePlayerContext, { ActivePlayerContextProps } from '../../context/active-player-context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';
import WebsocketContextProvider from '../../context/websocket_context_provider';
import GamesList from '../../pages/games_list';
import PrivateMessageModal from './messages/private_message';

// Components of lobby
// X Active players in lobby
// - Active games looking for players
// - Join game functionality (mouse or keyboard)
// - pub/sub & websocket event handling and emitting
// X Emit event when player enters lobby
// 1- Emit event when game is created to inLobby players not in game
// X Emit event when player leaves lobby
// X Mesaging between players
// -- Remove players from lobby if in active game
// X- Create closed messaging group for players in active game
// --- Connect to game instance websocket when player selects game instance

// 1 Emit event when game is created to inLobby players not in game
// ---- Remove navigation to :id/register route when game is created
// ---- On succesful response code for registering game, display active game in UI by emit event to all players
//      with ability to join game
// ---- All active games will have ability for player to join with button
// ---- Game will automatically emit event once max players reached and remove ability to connect with game from ui
// ---- Redirect game with players to avatar registration page according to game

export default function Lobby() {
  const lobbyData = useRouteLoaderData('lobby') as IPlayer[];
  const action = useActionData<boolean>() as boolean;
  const { activePlayer, setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  let activeStoredPlayer: Partial<IPlayer>;

  const storedPlayer = sessionStorage.getItem('activePlayer');

  if (storedPlayer) activeStoredPlayer = JSON.parse(storedPlayer);
  else activeStoredPlayer = activePlayer;

  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);

  const [activeLobby, setActiveLobby] = useState<IPlayer[]>(lobbyData);
  const [currentPlayer] = useState<Partial<IPlayer>>(activeStoredPlayer);
  const [messages, setMessages] = useState<PrivateMessageDetails[]>([]);
  const [openMessage, setOpenMessage] = useState<boolean>(false);
  const [messageTarget, setMessageTarget] = useState<PrivateMessageDetails | null>(null);

  const nav = useNavigate();

  useEffect(() => {
    setActivePlayer(currentPlayer);

    if (!socket.connected) {
      socket.connect();

      socket.on('connect', () => {
        console.log(`Websocket Connected to path: "/lobby" with id: ${socket.id}`);
      });

      if (action === true) {
        socket.emit('enter-lobby', currentPlayer);
      }

      socket.on('new-player', (data: IPlayer) => {
        console.log('NEW PLAYER EVENT ', data, '\n');
        setActiveLobby(prev => [...prev, data]);
      });

      socket.on('privateMessage', (message: PrivateMessageDetails) => {
        console.log(message);
        setMessages(prev => [...prev, message]);
      });

      socket.on('removePlayer', id => {
        setActiveLobby(activeLobby.filter(player => player.Id !== id));
      });
    }
    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, []);

  return (
    <WebsocketContextProvider>
      <Box component={'div'} id="lobby-wrapper">
        <Box component={'section'} id="lobby-title" textAlign={'center'}>
          <Text titleText="Game Lobby" titleVariant="h1" component={'h1'} />
        </Box>
        <Box component={'section'} id="lobby-data-wrapper" sx={{ display: 'flex', border: 5, height: '80vh' }}>
          <Box component={'section'} id="players-in-lobby-wrapper" sx={{ flex: 1 }}>
            <Text titleText={'Active Players'} titleVariant="h2" component={'h2'} sx={{ borderBottom: 2 }} />
            <Box component={'section'} id="players-in-lobby-list-wrapper" sx={{ borderRight: 2, height: '100%' }}>
              {activeLobby.map((e, i, arr) =>
                playersMapCallback(e, i, arr, currentPlayer, setOpenMessage, setMessageTarget)
              )}
            </Box>
          </Box>
          <Box component={'section'} id="active-games-not-started-wrapper" sx={{ flex: 1 }}>
            <GamesList />
          </Box>
          <Box component={'section'} id="lobby-messages-wrapper" sx={{ flex: 1 }}>
            <Text titleText="Messages" titleVariant="h2" component={'h2'} sx={{ borderBottom: 2 }} />
            <Box component={'section'} id="lobby-messages" sx={{ borderLeft: 2, height: '100%' }}>
              {messages.map(messagesListCallback)}
            </Box>
          </Box>
        </Box>
        <Outlet />
        <Button
          onClick={() => {
            socket.emit('removePlayer', currentPlayer.Id);
            sessionStorage.removeItem('activePlayer');
            setActivePlayer({ Name: '', Id: '', InLobby: false });
            nav('/');
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
  e: unknown,
  _i: number,
  _arr: unknown,
  currentPlayer: Partial<IPlayer>,
  setOpenMessage: Dispatch<SetStateAction<boolean>>,
  setMessageTarget: Dispatch<SetStateAction<PrivateMessageDetails | null>>
): ReactElement {
  const { Name, Id } = e as Partial<IPlayer>;
  return (
    <Box
      component={'section'}
      id={`active-player-${Name}-${Id}-wrapper`}
      key={`active-player-${Name}-${Id}-wrapper`}
      sx={{ borderBottom: 2, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}
    >
      <Text key={`${Name}-${Id}`} titleText={Name} titleVariant="body1" component={'p'} sx={{}} />
      {Id !== currentPlayer.Id && (
        <Button
          LinkComponent={'button'}
          name={Name}
          id={`message-player-${Id}-button`}
          size="small"
          onClick={() =>
            handleMessageClick(
              {
                sender: {
                  senderName: currentPlayer.Name as string,
                  senderId: currentPlayer.Id as string
                },
                target: {
                  targetName: Name as string,
                  targetId: Id as string
                },
                message: ''
              },
              setOpenMessage,
              setMessageTarget
            )
          }
        >
          <Label
            labelText="Message"
            tooltipTitle={'Click to send message to player'}
            labelVariant={'button'}
            id={`message-player-${Id}-button-label`}
            placement={'right'}
            htmlFor={'`message-player-${Id}-button`'}
            labelTextSx={{ fontSize: '2rem' }}
          />
        </Button>
      )}
    </Box>
  );
}

async function handleMessageClick(
  messageDetails: PrivateMessageDetails,
  setOpenMessage: Dispatch<SetStateAction<boolean>>,
  setMessageTarget: Dispatch<SetStateAction<PrivateMessageDetails | null>>
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
