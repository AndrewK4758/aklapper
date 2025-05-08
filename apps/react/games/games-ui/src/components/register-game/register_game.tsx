import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';

export interface RegisterGameProps {
  registerGameButtonSx: SxProps;
  gameName: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
  // setJoinedGame: Dispatch<SetStateAction<string | null>>;
}

export default function RegisterGame({ gameName, registerGameButtonSx, setOpen }: RegisterGameProps) {
  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const nav = useNavigate();

  return (
    <Button
      onMouseDown={() => {
        if (activePlayer.id) {
          socket.emit('create-new-game', { gameName, playerId: activePlayer.id });
          setOpen(false);
        } else {
          alert('Please login create or join a game');
          nav('/');
        }
      }}
      sx={registerGameButtonSx}
    >
      Register Game
    </Button>
  );
}
