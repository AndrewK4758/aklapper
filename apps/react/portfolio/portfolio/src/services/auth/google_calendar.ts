import type { CodeResponse } from '@react-oauth/google';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { GoogleUserContextInfo } from '../../contexts/contact_context_constants';

const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

export default async function onGoogleOAuth2Success(
  code: CodeResponse,
  setUser: (user: GoogleUserContextInfo) => void,
  toggleAuthorizing: (isAuth: boolean) => void,
): Promise<void> {
  try {
    const resp = await axios.post(`${baseURL}/tokens`, { code }, { withCredentials: true });

    let { idToken } = resp.data;

    let { email, name, picture } = jwtDecode<GoogleUserContextInfo>(idToken);

    setUser({ email, name, picture });

    idToken = null;
    email = '';
    name = '';
    picture = '';
  } catch (error) {
    console.error(error);
  } finally {
    toggleAuthorizing(false);
  }
}
