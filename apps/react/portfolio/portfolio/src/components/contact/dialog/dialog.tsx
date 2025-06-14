import type { DialogProps } from '@mui/material/Dialog';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleUserContextProvider from '../../../contexts/contact-context.js';
import LargeStyledDialog from '../../styled/large_dialog_window.js';

interface DialogLayoutProps extends Omit<DialogProps, 'id' | 'data-testid' | 'scroll' | 'open' | 'maxWidth'> {
  isOpen: boolean;
  tab: number;
  handleSetTab: (tab: number) => void;
}

export default function DialogLayout({ tab, isOpen, handleSetTab, ...props }: DialogLayoutProps) {
  const { children } = props;
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        localeText={enUS.components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <GoogleUserContextProvider>
          <LargeStyledDialog
            {...props}
            maxWidth='xl'
            open={isOpen}
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
