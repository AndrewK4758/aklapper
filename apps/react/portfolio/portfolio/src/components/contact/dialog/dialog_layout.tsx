import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactElement } from 'react';
import GoogleUserContextProvider from '../../../contexts/contact-context.js';
import { BOX_SHADOW_MAIN_DARK } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';
import LargeStyledDialog from '../../styled/large_dialog_window.js';

interface DialogLayoutProps {
  isOpen: boolean;
  children: ReactElement<unknown, any>[];
}

export default function DialogLayout({
  isOpen,
  children,
  ...props
}: DialogLayoutProps): ReactElement<DialogLayoutProps> {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        localeText={enUS.components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <GoogleUserContextProvider>
          <LargeStyledDialog
            {...props}
            open={isOpen}
            id='contact-dialog'
            data-testid='contact-dialog'
            scroll='body'
            slotProps={{
              paper: { sx: { background: Theme.palette.background.paper, boxShadow: BOX_SHADOW_MAIN_DARK } },
            }}
          >
            {children}
          </LargeStyledDialog>
        </GoogleUserContextProvider>
      </LocalizationProvider>
    </GoogleOAuthProvider>
  );
}
