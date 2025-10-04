import { LargeStyledDialog } from '@aklapper/react-shared';
import type { DialogProps } from '@mui/material/Dialog';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactElement } from 'react';
import GoogleUserContextProvider from '../../../contexts/contact-context';

interface DialogLayoutProps extends DialogProps {
  open: boolean;
  children: ReactElement | ReactElement[];
}

export default function DialogLayout({ open, children, ...props }: DialogLayoutProps): ReactElement<DialogLayoutProps> {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        localeText={enUS.components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <GoogleUserContextProvider>
          <LargeStyledDialog
            {...props}
            open={open}
            fullScreen
            id='contact-dialog'
            data-testid='contact-dialog'
            scroll='body'
          >
            {children}
          </LargeStyledDialog>
        </GoogleUserContextProvider>
      </LocalizationProvider>
    </GoogleOAuthProvider>
  );
}
