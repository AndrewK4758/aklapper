import type { DialogProps } from '@mui/material/Dialog';
import Dialog from '@mui/material/Dialog';
import type { SlideProps } from '@mui/material/Slide';
import Slide from '@mui/material/Slide';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { forwardRef, type ReactElement } from 'react';
import GoogleUserContextProvider from '../../../contexts/contact-context';
import ContactDialog from '../contact_dialog';

interface DialogLayoutProps extends DialogProps {
  open: boolean;
  handleClose: () => void;
}

export default function DialogLayout({
  open,
  handleClose,
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
          <Dialog
            {...props}
            open={open}
            onClose={handleClose}
            fullScreen
            id='contact-dialog'
            data-testid='contact-dialog'
            scroll='body'
            slots={{ transition: ZoomTransition }}
            slotProps={{
              transition: {
                unmountOnExit: true,
                mountOnEnter: false,
                timeout: {
                  appear: 0,
                  enter: 450,
                  exit: 225,
                },
              },
            }}
          >
            <ContactDialog handleClose={handleClose} />
          </Dialog>
        </GoogleUserContextProvider>
      </LocalizationProvider>
    </GoogleOAuthProvider>
  );
}

const ZoomTransition = forwardRef(function ({ ...props }: SlideProps, ref) {
  return (
    <Slide {...props} direction='left' ref={ref}>
      {props.children}
    </Slide>
  );
});
