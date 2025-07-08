import type { GamePlayerValidation } from '@aklapper/types';
import Button from '@mui/material/Button';
import axios from 'axios';
import type { Dispatch, ReactElement } from 'react';
import { Socket } from 'socket.io-client';
import type { IActiveGameInfo } from '../../../types/types';
import { getGameInstanceInfo } from '../../../utils/utils';
import AnimatedBorderBox from '../../styled/animated_border_box';
import { Action } from './socket-reducer';

interface TakeTurnProps {
  dispatch: Dispatch<Action>;
  socket: Socket;
  state: IActiveGameInfo;
}

/**
 * This component renders a button that allows users to take their turn in a Tic Tac Toe game.
 *
 * @param {TakeTurnProps} props - The props for the TakeTurnTicTacToe component.
 * @param {Dispatch<Action>} props.dispatch - A function to dispatch actions to the reducer.
 * @param {Socket} props.socket - The socket.io socket object.
 * @param {string | undefined} props.position - The position on the board where the player wants to place their mark.
 * @param {string} props.avatarInTurn - The avatar of the player whose turn it is.
 * @returns {ReactElement} The rendered TakeTurnTicTacToe component.
 */

const TakeTurnTicTacToe = ({ dispatch, socket, state }: TakeTurnProps): ReactElement => (
  <AnimatedBorderBox>
    <Button
      variant='outlined'
      disabled={!!state.winner}
      onClick={() => handleTakeTurn({ dispatch, socket, state })}
      sx={{ height: '100%' }}
    >
      Take Turn
    </Button>
  </AnimatedBorderBox>
);

export default TakeTurnTicTacToe;

const baseURL = import.meta.env.VITE_GAMES_API_URL;

/**
 * This function handles the take turn button click event for the Tic Tac Toe game.
 * It sends a PATCH request to the server to take the turn and dispatches an action to update the game state.
 *
 * @param {TakeTurnProps} props - The props for the handleTakeTurn function.
 * @param {Dispatch<Action>} props.dispatch - A function to dispatch actions to the reducer.
 * @param {Socket} props.socket - The socket.io socket object.
 * @param {string | undefined} props.position - The position on the board where the player wants to place their mark.
 * @param {string} props.avatarInTurn - The avatar of the player whose turn it is.
 */

const handleTakeTurn = async ({ dispatch, socket, state }: TakeTurnProps) => {
  try {
    const { avatarInTurn, space } = state;
    const gameInfo = getGameInstanceInfo() as GamePlayerValidation;
    const playersIds = JSON.parse(sessionStorage.getItem('playersIds') as string);
    const playerId = playersIds[avatarInTurn];
    gameInfo.playerID = playerId;

    const reqHeaders = {
      headers: {
        'current-game': JSON.stringify(gameInfo),
      },
    };

    const resp = await axios.patch(`${baseURL}/games/Tic-Tac-Toe/take-turn`, { position: space }, reqHeaders);

    console.log(resp.data.turnStatus);

    return null;
  } catch (err) {
    console.log(err);
    return null;
  } finally {
    dispatch({ type: Action.TAKE_TURN, socket: socket, payload: state });
  }
};
