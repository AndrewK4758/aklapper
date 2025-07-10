import type { CodeResponse } from '@react-oauth/google';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { GoogleUserContextInfo } from '../../contexts/contact_context_constants';

const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

export default async function onGoogleOAuth2Success(
  code: CodeResponse,
  setUser: (user: GoogleUserContextInfo) => void,
  toggleAuthorizing: () => void,
): Promise<void> {
  try {
    const resp = await axios.post(`${baseURL}/create-tokens`, { code }, { withCredentials: true });

    let { idToken } = resp.data;

    let { email, name }: GoogleUserContextInfo = jwtDecode(idToken);

    setUser({ email: email, name: name });

    idToken = null;
    email = '';
    name = '';
  } catch (error) {
    console.error(error);
  } finally {
    toggleAuthorizing();
  }
}
