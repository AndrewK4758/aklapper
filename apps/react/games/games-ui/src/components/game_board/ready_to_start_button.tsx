import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import axios from 'axios';
import type { Dispatch } from 'react';
import { useParams } from 'react-router';
import { Socket } from 'socket.io-client';
import { GamesTheme as Theme } from '../../styles/games-theme';
import getGameInstanceInfo from '../../utils/utils';
import { type Action, ActionType } from './socket-reducer';

const breakpointsStartGameButtonBox: SxProps = {
  flex: '0 1 20%',
  justifyItems: 'center',
  alignContent: 'center',
  [Theme.breakpoints.down('md')]: {},
};

const breakpointsStartGameButtonFormButton: SxProps = {
  textAlign: 'center',
  [Theme.breakpoints.down('md')]: {
    fontSize: '17px',
    width: 130,
    height: 35,
  },
};

interface ReadyToStartProps {
  dispatch: Dispatch<Action>;
  socket: Socket;
}

export default function ReadyToStart({ dispatch, socket }: ReadyToStartProps) {
  const __baseURL__ = import.meta.env.VITE_REST_API_SERVER_URL;
  const params = useParams();

  const id = params.id;
  const reqHeaders = {
    headers: {
      'current-game': JSON.stringify(getGameInstanceInfo()),
    },
  };

  const handleStartGame = async () => {
    const resp = await axios.patch(`${__baseURL__}/games/${id}/start`, {}, reqHeaders);
    dispatch({ type: ActionType.START, socket: socket });
    console.log(resp.data.message);
  };

  return (
    <Container component={'section'} sx={breakpointsStartGameButtonBox}>
      <Button onClick={handleStartGame} variant='outlined' type='button' sx={breakpointsStartGameButtonFormButton}>
        Start Game
      </Button>
    </Container>
  );
}
