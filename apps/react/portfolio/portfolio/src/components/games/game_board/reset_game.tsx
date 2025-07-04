import Button from '@mui/material/Button';
import axios from 'axios';
import type { ActionDispatch, JSX } from 'react';
import { useParams } from 'react-router';
import { Socket } from 'socket.io-client';
import type { IActiveGameInfo } from '../../../types/types';
import { getGameInstanceInfo } from '../../../utils/utils';
import { Action } from './socket-reducer';

interface ResetGameProps {
  dispatch: ActionDispatch<[action: Action]>;
  socket: Socket;
  state: IActiveGameInfo;
}

/**
 * This component renders a button that allows users to reset a game.
 *
 * @param {ResetGameProps} props - The props for the ResetGame component.
 * @param {Dispatch<Action>} props.dispatch - A function to dispatch actions to the reducer.
 * @param {Socket} props.socket - The socket.io socket object.
 * @param {Dispatch<SetStateAction<string | undefined>>} props.setSpace - A function to update the selected space on the game board.
 * @returns {JSX.Element} The rendered ResetGame component.
 */

export default function ResetGame({ dispatch, socket, state }: ResetGameProps): JSX.Element {
  const { id } = useParams() as { id: string };

  return (
    <Button onClick={() => handleResetGame({ dispatch, socket, id, state })} variant='outlined' type='button'>
      Reset
    </Button>
  );
}

const baseURL = import.meta.env.VITE_GAMES_API_URL;

/**
 * This function handles the reset game button click event.
 * It sends a PATCH request to the server to reset the game and dispatches an action to update the game state.
 *
 * @param {ResetGameProps & { id: string | undefined }} props - The props for the handleResetGame function.
 */

const handleResetGame = async ({ dispatch, socket, id, state }: ResetGameProps & { id: string | undefined }) => {
  const reqHeaders = {
    headers: {
      'current-game': JSON.stringify(getGameInstanceInfo()),
    },
  };
  try {
    await axios.patch(`${baseURL}/games/${id}/reset`, {}, reqHeaders);
    dispatch({ type: Action.RESET, socket: socket, payload: state });
    return null;
  } catch (error) {
    console.log(error);
    return null;
  } finally {
    dispatch({ type: Action.SPACE, payload: { ...state, space: undefined } });
  }
};
