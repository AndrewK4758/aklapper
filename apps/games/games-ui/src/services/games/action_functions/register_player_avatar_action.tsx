import { IRegisterUserClient } from '@aklapper/types-api';
import { IRegisterFormValues } from '@aklapper/types-game';
import axios from 'axios';
import { ActionFunction, ActionFunctionArgs } from 'react-router-dom';

const registerPlayerAndAvatarAction: ActionFunction = async ({ request, params }: ActionFunctionArgs) => {
  const baseURL = import.meta.env.VITE_REST_API_SERVER_URL;
  const id = params.id;

  const data: IRegisterFormValues = await request.json();

  const avatarName = data.avatarName;
  const playerName =
    data.playerName.length === 0
      ? (JSON.parse(sessionStorage.getItem('user') as string).playerName as IRegisterUserClient)
      : data.playerName;
  const avatarColor = data.avatarColor;

  const registerFormValues = {
    playerName: playerName,
    avatarName: avatarName,
    avatarColor: avatarColor,
  } as IRegisterFormValues;

  const reqHeaders = {
    headers: {
      'current-game': sessionStorage.getItem('__current_game__'),
    },
  };

  try {
    const resp = await axios.patch(`${baseURL}/games/${id}/register`, registerFormValues, reqHeaders);

    sessionStorage.setItem('__current_game__', resp.headers['current-game']);

    return resp.data;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export default registerPlayerAndAvatarAction;