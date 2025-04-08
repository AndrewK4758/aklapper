import Button from '@mui/material/Button';
import { SxProps } from '@mui/material/styles';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import { WebsocketContext, WebsocketContextProps } from '../../context/websocket_context';

export interface RegisterGameProps {
  registerGameButtonSx: SxProps;
  gameName: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export default function RegisterGame({ gameName, registerGameButtonSx, setOpen }: RegisterGameProps) {
  const { socket } = useContext<WebsocketContextProps>(WebsocketContext);

  return (
    <Button
      onClick={() => {
        socket.emit('create-new-game', gameName);
        setOpen(false);
      }}
      sx={registerGameButtonSx}
    >
      Register Game
    </Button>
  );
}
