import { Label, Text } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useContext, useEffect, useState, type ReactElement } from 'react';
import { useActionData, useRouteLoaderData } from 'react-router';
import type { Socket } from 'socket.io-client';
import { ActivePlayerContext, ActivePlayerContextProps } from '../../context/active-player-context';
import WebsocketContextProvider, {
  WebsocketContext,
  type WebsocketContextProps
} from '../../context/websocket_context';
import GamesList from '../../pages/games_list';

// Components of lobby
// X Active players in lobby
// - Active games looking for players
// - Join game functionality (mouse or keyboard)
// - pub/sub & websocket event handling and emitting
// X- Emit event when player enters lobby
// -- Emit event when game is created to inLobby players not in game
// X- Emit event when player leaves lobby
// -- Mesaging between players
// -- Remove players from lobby if in active game
// X-- Create closed messaging group for players in active game
// --- Connect to game instance websocket when player selects game instance

export default function Lobby() {
  const storedPlayer = JSON.parse(sessionStorage.getItem('activePlayer') as string) as Partial<IPlayer>;
  const { setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const lobbyData = useRouteLoaderData('lobby') as IPlayer[];
  const action = useActionData<IPlayer>() as IPlayer;
  const [activeLobby, setActiveLobby] = useState<IPlayer[]>(lobbyData);
  const [currentPlayer] = useState<Partial<IPlayer>>(storedPlayer);
  const [messages, setMessages] = useState<string[]>([]);

  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);

  useEffect(() => {
    setActivePlayer(currentPlayer);
    if (!socket.connected) {
      socket.connect();

      socket.on('connect', () => {
        console.log(`Websocket Connected to path: "/lobby" with id: ${socket.id}`);
      });

      if (action) {
        socket.emit('enter-lobby', currentPlayer);
      }

      socket.on('new-player', (data: IPlayer) => {
        console.log('NEW PLAYER EVENT ', data, '\n');
        setActiveLobby(prev => [...prev, data]);
      });

      socket.on('privateMessage', message => {
        console.log(message);
        setMessages(prev => [...prev, message]);
      });

      socket.on('removePlayer', id => {
        setActiveLobby(activeLobby.filter(player => player.Id !== id));
      });
    }
    return () => {
      if (socket.connected) {
        socket.emit('removePlayer', currentPlayer.Id);
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
        <Box component={'section'} id="lobby-data-wrapper" sx={{ display: 'flex', border: 2 }}>
          <Box component={'section'} id="players-in-lobby-wrapper" sx={{ border: 2 }}>
            <Text titleText={'Active Players'} titleVariant="h2" component={'h2'} sx={{ borderBottom: 2 }} />
            {activeLobby.map((e, i, arr) => playersMapCallback(e, i, arr, currentPlayer, socket))}
          </Box>
          <Box component={'section'} id="active-games-not-started-wrapper">
            <GamesList />
          </Box>
          <Box component={'section'} id="lobby-messages-wrapper">
            <Text titleText="Messages" titleVariant="h2" component={'h2'} sx={{ borderBottom: 2 }} />
            <Box component={'section'} id="lobby-messages">
              {messages.map(message => (
                <pre key={message}>{message}</pre>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </WebsocketContextProvider>
  );
}

function playersMapCallback(
  e: unknown,
  _i: number,
  _arr: unknown,
  currentPlayer: Partial<IPlayer>,
  socket: Socket
): ReactElement {
  const { Name, Id } = e as Partial<IPlayer>;
  return (
    <Box
      component={'section'}
      id={`active-player-${Name}-${Id}-wrapper`}
      key={`active-player-${Name}-${Id}-wrapper`}
      sx={{ border: 2, display: 'flex', justifyContent: 'space-around' }}
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
                senderName: currentPlayer.Name as string,
                senderId: currentPlayer.Id as string,
                targetName: Name as string,
                targetId: Id as string
              },
              socket
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

type PrivateMessage = {
  senderName: string;
  senderId: string;
  targetName: string;
  targetId: string;
};

async function handleMessageClick(messageDetails: PrivateMessage, socket: Socket) {
  const { senderName, senderId, targetId, targetName } = messageDetails;
  socket.emit('privateMessagePlayer', {
    target: {
      targetId,
      targetName
    },
    message: `This is a message from ${senderName} to ${targetName}`,
    sender: {
      senderName,
      senderId
    }
  });
}
