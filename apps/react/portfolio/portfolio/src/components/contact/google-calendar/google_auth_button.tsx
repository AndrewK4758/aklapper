import { SectionTitle } from '@aklapper/react-shared';
import GoogleIcon from '@mui/icons-material/Google';
import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import { useGoogleLogin } from '@react-oauth/google';
import { useContext, useState, type ReactElement } from 'react';
import { GoogleUserContext, type GoogleUserContextProps } from '../../../contexts/contact_context_constants';
import onGoogleOAuth2Success from '../../../services/auth/google_calendar';
import AnimatedBorderBox from '../../styled/animated_border_box.js';

export default function GoogleAuthButton(): ReactElement<ButtonProps> {
  const { handleSetGoogleUser } = useContext<GoogleUserContextProps>(GoogleUserContext);
  const [authorizing, setAuthorizing] = useState(false);

  const toggleAuthorizing = () => {
    setAuthorizing(!authorizing);
  };

  const login = useGoogleLogin({
    onSuccess: code => onGoogleOAuth2Success(code, handleSetGoogleUser, toggleAuthorizing),
    onError: err => {
      console.error(`Error: ${err.error}`);
      toggleAuthorizing();
    },
    onNonOAuthError: err => {
      console.error(`NonOAuthError: ${err}`);
      toggleAuthorizing();
    },
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });

  const handleLogin = () => {
    setAuthorizing(true);
    login();
  };

  return (
    <AnimatedBorderBox component={'section'} data-testid='google-calendar-auth-box'>
      <Button
        id='google-auth-button'
        data-testid='google-auth-button'
        onClick={handleLogin}
        disabled={authorizing}
        endIcon={<GoogleIcon color='inherit' fontSize='inherit' />}
      >
        <SectionTitle id='google-auth-button-label' variant='body1' title='Connect Google Calendar' />
      </Button>
    </AnimatedBorderBox>
  );
}
