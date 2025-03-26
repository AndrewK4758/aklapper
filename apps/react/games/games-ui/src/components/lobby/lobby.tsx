import { Text } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Box from '@mui/material/Box';
import { useContext, useEffect, useRef, useState, type ReactElement } from 'react';
import { useActionData, useRouteLoaderData } from 'react-router';
import type { ManagerOptions, Socket } from 'socket.io-client';
import { ActivePlayerContext, type ActivePlayerContextProps } from '../../context/active-player-context';
import ClientSocket from '../../utils/web-socket/socket-instance';

// Components of lobby
// - Active players in lobby
// - Active games looking for players
// - Join game functionality (mouse or keyboard)
// - pub/sub & websocket event handling and emitting
// -- Emit event when player enters lobby
// -- Emit event when game is created to inLobby players not in game
// -- Emit event when player leaves lobby
// -- Mesaging between players
// -- Remove players from lobby if in active game
// --- Create closed messaging group for players in active game
// --- Connect to game instance websocket when player selects game instance

const wsUrl = import.meta.env.VITE_WS_SERVER_URL;

export default function Lobby() {
  const managerOptions: Partial<ManagerOptions> = {
    path: '/lobby',
    autoConnect: false
  };

  const { setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const lobbyData = useRouteLoaderData('lobby') as IPlayer[];
  const action = useActionData<IPlayer>() as IPlayer;
  const [activeLobby, setActiveLobby] = useState<IPlayer[]>(lobbyData);
  const clientSocket = new ClientSocket(wsUrl, managerOptions);
  const socketRef = useRef<Socket>(clientSocket.Socket);

  const socket = socketRef.current;

  useEffect(() => {
    // if (lobby) setActiveLobby(lobby);
    setActiveLobby(lobbyData);
    if (!socket.connected) {
      socket.connect();

      socket.on('connect', () => {
        console.log(`Websocket Connected to path: "/lobby" with id: ${socket.id}`);
      });
      // add conditional to only emit one time to prevent map key issue if screen is refreshed
      if (action) {
        const currentPlayer = { Name: action.Name, Id: action.Id };
        setActivePlayer(currentPlayer);
        socket.emit('player-enter', currentPlayer);
      }

      socket.on('new-player', (data: IPlayer) => {
        console.log('NEW PLAYER EVENT ', data, '\n');
        setActiveLobby(prev => [...prev, data]);
        // revalidate();
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
    <Box component={'div'} id="lobby-wrapper">
      <Box component={'section'} id="lobby-title" textAlign={'center'}>
        <Text titleText="Game Lobby" titleVariant="h1" component={'h1'} />
      </Box>
      <Box component={'section'} id="players-in-lobby-wrapper" sx={{ border: 2 }}>
        {activeLobby.map(playersMapCallback)}
      </Box>
      <Box component={'section'} id="active-games-not-started-wrapper"></Box>
      <Box component={'section'} id="lobby-messages-wrapper"></Box>
    </Box>
  );
}

function playersMapCallback(e: unknown, _i: number, _arr: unknown): ReactElement {
  const { Name, Id } = e as Partial<IPlayer>;

  return (
    <Box component={'section'} id={`active-player-${Name}-${Id}-wrapper`} key={`active-player-${Name}-${Id}-wrapper`}>
      <Text key={`${Name}-${Id}`} titleText={Name} titleVariant="body1" component={'p'} sx={{}} />
    </Box>
  );
}
