import axios from 'axios';
import { Dispatch, FocusEvent, SetStateAction } from 'react';

const baseURL = import.meta.env.VITE_REST_API_SERVER_URL;

const verifyEmailOnBlur = async (event: FocusEvent<unknown>, setNoEmailError: Dispatch<SetStateAction<string>>) => {
  const email = (event.target as HTMLInputElement).value;

  const resp = await axios.get(`${baseURL}/validate-user?email=${email}`);

  if (!resp.data.message) setNoEmailError(`Email not recognized.\nPlease register to continue`);
};

export default verifyEmailOnBlur;
