import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import axios from 'axios';
import type { Dispatch } from 'react';
import { useParams } from 'react-router';
import { Socket } from 'socket.io-client';
import { GamesTheme as Theme } from '../../styles/games-theme';
import getGameInstanceInfo from '../../utils/utils';
import { type Action, ActionType } from './socket-reducer';

const breakpointsResetGameButton: SxProps = {
  marginLeft: '.5rem',
  backgroundColor: Theme.palette.info.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '17px',
    width: 130,
    height: 35,
  },
};

interface ResetGameProps {
  dispatch: Dispatch<Action>;
  socket: Socket;
}

export default function ResetGame({ dispatch, socket }: ResetGameProps) {
  const params = useParams();
  const id = params.id;

  const handleResetGame = async () => {
    const __baseURL__ = import.meta.env.VITE_REST_API_SERVER_URL;
    const reqHeaders = {
      headers: {
        'current-game': JSON.stringify(getGameInstanceInfo()),
        Authorization: sessionStorage.getItem('token'),
      },
    };
    try {
      await axios.patch(`${__baseURL__}/games/${id}/reset`, {}, reqHeaders);
      dispatch({ type: ActionType.RESET, socket: socket });
      return null;
    } catch (error) {
      console.log(error);
      return null;
    }
  };

  return (
    <Button onClick={handleResetGame} variant='outlined' type='button' sx={breakpointsResetGameButton}>
      Reset
    </Button>
  );
}
