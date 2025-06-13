import { SectionTitle } from '@aklapper/react-shared';
import GoogleIcon from '@mui/icons-material/Google';
import Button from '@mui/material/Button';
import { useGoogleLogin, type CodeResponse } from '@react-oauth/google';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useContext } from 'react';
import {
  GoogleUserContext,
  type GoogleUserContextInfo,
  type GoogleUserContextProps,
} from '../../../contexts/contact-context.js';
import AnimatedBorderBox from '../../styled/animated_border_box.js';

export default function GoogleAuthButton() {
  const { handleSetGoogleUser } = useContext<GoogleUserContextProps>(GoogleUserContext);
  const login = useGoogleLogin({
    onSuccess: code => onGoogleSuccess(code, handleSetGoogleUser),
    onError: err => console.error(err),
    onNonOAuthError: err => console.error(err),
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });
  return (
    <AnimatedBorderBox component={'section'} id='google-calendar-auth-box' data-testid='google-calendar-auth-box'>
      <Button
        id='google-auth-button'
        data-testid='google-auth-button'
        onClick={login}
        endIcon={<GoogleIcon color='inherit' fontSize='inherit' />}
        sx={{ width: '100%' }}
      >
        <SectionTitle
          id='google-auth-button-label'
          tooltipTitle={'Connect your Google Calendar to sync appointment request with your Google Calendar'}
          variant='body1'
          title='Connect Google Calendar'
          placement='bottom-start'
        />
      </Button>
    </AnimatedBorderBox>
  );
}

//TODO - move to services directory

const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

console.log(baseURL);
const onGoogleSuccess = async (code: CodeResponse, setUser: (user: GoogleUserContextInfo) => void) => {
  try {
    const resp = await axios.post(`${baseURL}/create-tokens`, { code }, { withCredentials: true });

    let { idToken } = resp.data;

    let { email, name }: GoogleUserContextInfo = jwtDecode(idToken);

    setUser({ email: email, name: name });

    idToken = null;
    email = '';
    name = '';

    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};
