import type { AxiosError } from 'axios';
import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';

const loginUserAction: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  const { email, password } = await request.json();
  const baseURL = import.meta.env.VITE_REST_API_SERVER_URL;

  try {
    const resp = await axios.patch(`${baseURL}/login`, { email: email, password: password });
    console.log(resp.data);
    return resp.data;
  } catch (err) {
    console.error(err);
    const { response } = err as AxiosError;
    return response?.data;
  }
};
export default loginUserAction;
