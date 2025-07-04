import type { GamePlayerValidation } from '@aklapper/types';
import Button from '@mui/material/Button';
import axios from 'axios';
import type { Dispatch, JSX } from 'react';
import { Socket } from 'socket.io-client';
import type { IActiveGameInfo } from '../../../types/types';
import { getGameInstanceInfo } from '../../../utils/utils.jsx';
import AnimatedBorderBox from '../../styled/animated_border_box';
import { Action } from './socket-reducer';

const baseURL = import.meta.env.VITE_GAMES_API_URL;

interface TakeTurnProps {
  dispatch: Dispatch<Action>;
  socket: Socket;
  state: IActiveGameInfo;
}

/**
 * This component renders a button that allows users to take their turn in a game.
 *
 * @param {TakeTurnProps} props - The props for the TakeTurn component.
 * @param {Dispatch<Action>} props.dispatch - A function to dispatch actions to the reducer.
 * @param {Socket} props.socket - The socket.io socket object.
 * @param {string} props.avatarInTurn - The avatar of the player whose turn it is.
 * @returns {JSX.Element} The rendered TakeTurn component.
 */

export default function TakeTurn({ dispatch, socket, state }: TakeTurnProps): JSX.Element {
  return (
    <AnimatedBorderBox>
      <Button
        variant='outlined'
        disabled={!!state.winner}
        onClick={() => handleTakeTurn(dispatch, socket, state)}
        sx={{ height: '100%' }}
      >
        Take Turn
      </Button>
    </AnimatedBorderBox>
  );
}

/**
 * This function handles the take turn button click event.
 * It sends a PATCH request to the server to take the turn and dispatches an action to update the game state.
 *
 * @param {Dispatch<Action>} dispatch - A function to dispatch actions to the reducer.
 * @param {Socket} socket - The socket.io socket object.
 * @param {string} avatarInTurn - The avatar of the player whose turn it is.
 * @returns null
 */
const handleTakeTurn = async (dispatch: Dispatch<Action>, socket: Socket, state: IActiveGameInfo) => {
  try {
    const { avatarInTurn } = state;
    const gameInfo = getGameInstanceInfo() as GamePlayerValidation;
    const playersIds = JSON.parse(sessionStorage.getItem('playersIds') as string);
    const playerId = playersIds[avatarInTurn];
    gameInfo.playerID = playerId;
    const reqHeaders = {
      headers: {
        'current-game': JSON.stringify(gameInfo),
      },
    };

    const resp = await axios.patch(`${baseURL}/games/Chutes-&-Ladders/take-turn`, {}, reqHeaders);
    console.log(resp.data.turnStatus);
  } catch (err) {
    console.log(err);
  } finally {
    dispatch({ type: Action.TAKE_TURN, socket: socket, payload: state });
  }
};
