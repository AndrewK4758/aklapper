import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { WebsocketContext, type WebsocketContextProps } from '../../context/websocket_context';

export interface RegisterGameProps {
  registerGameButtonSx: SxProps;
  gameName: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export default function RegisterGame({ gameName, registerGameButtonSx, setOpen }: RegisterGameProps) {
  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);
  const { activePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);

  return (
    <Button
      onClick={() => {
        socket.emit('create-new-game', { gameName, playerId: activePlayer.Id });
        setOpen(false);
      }}
      sx={registerGameButtonSx}
    >
      Register Game
    </Button>
  );
}
