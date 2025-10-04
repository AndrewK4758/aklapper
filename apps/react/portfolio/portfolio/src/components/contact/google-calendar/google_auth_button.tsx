import GoogleIcon from '@mui/icons-material/Google';
import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import { useGoogleLogin } from '@react-oauth/google';
import { useContext, type ReactElement } from 'react';
import { GoogleUserContext, type GoogleUserContextProps } from '../../../contexts/contact_context_constants';
import onGoogleOAuth2Success from '../../../services/auth/google_calendar';
import AnimatedBorderBox from '../../styled/animated_border_box';

interface GoogleAuthButtonProps {
  isAuthenticating: boolean;
  handleIsAuthenticating: (isAuth: boolean) => void;
}

export default function GoogleAuthButton({
  isAuthenticating,
  handleIsAuthenticating,
}: GoogleAuthButtonProps): ReactElement<ButtonProps> {
  const { handleSetGoogleUser } = useContext<GoogleUserContextProps>(GoogleUserContext);

  const toggleAuthenticating = (isAuthenticating: boolean) => {
    handleIsAuthenticating(isAuthenticating);
  };

  const login = useGoogleLogin({
    onSuccess: code => onGoogleOAuth2Success(code, handleSetGoogleUser, toggleAuthenticating),
    onError: err => {
      console.error(`Error: ${err.error}`);
      toggleAuthenticating(false);
    },
    onNonOAuthError: err => {
      console.error(`NonOAuthError: ${err}`);
      toggleAuthenticating(false);
    },
    flow: 'auth-code',
    scope: import.meta.env.VITE_OAUTH_SCOPE,
  });

  const handleLogin = () => {
    handleIsAuthenticating(true);
    login();
  };

  return (
    <AnimatedBorderBox component={'section'} data-testid='google-calendar-auth-box'>
      <Button
        id='google-auth-button'
        data-testid='google-auth-button'
        onClick={handleLogin}
        disabled={isAuthenticating}
        endIcon={<GoogleIcon color='inherit' fontSize='inherit' />}
      >
        Connect Google Calendar
      </Button>
    </AnimatedBorderBox>
  );
}
