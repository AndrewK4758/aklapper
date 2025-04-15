import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import axios from 'axios';
import type { Dispatch } from 'react';
import { useParams } from 'react-router';
import { Socket } from 'socket.io-client';
import { GamesTheme as Theme } from '../../styles/games-theme';
import getGameInstanceInfo from '../../utils/utils';
import { type Action, ActionType } from './socket-reducer';

const breakpointsTakeTurnButton: SxProps = {
  backgroundColor: Theme.palette.info.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '17px',
    width: 130,
    height: 35,
  },
};

interface TakeTurnProps {
  dispatch: Dispatch<Action>;
  socket: Socket;
  position: string | undefined;
}

export default function TakeTurnTicTacToe({ dispatch, socket, position }: TakeTurnProps) {
  const params = useParams();
  const id = params.id;

  console.log(position, 'out of button');
  const handleTakeTurn = async () => {
    const baseURL = import.meta.env.VITE_REST_API_SERVER_URL;
    const __current_game__ = JSON.stringify(getGameInstanceInfo());
    console.log(position, 'in button');
    try {
      const resp = await axios.patch(
        `${baseURL}/games/${id}/take-turn`,
        { position: position },
        { headers: { 'current-game': __current_game__ } },
      );
      console.log(resp.data.turnStatus);
      dispatch({ type: ActionType.TAKE_TURN, socket: socket });
      return null;
    } catch (err) {
      console.log(err);
      return null;
    }
  };

  return (
    <Button variant='outlined' type='button' onClick={handleTakeTurn} sx={breakpointsTakeTurnButton}>
      Take Turn
    </Button>
  );
}
