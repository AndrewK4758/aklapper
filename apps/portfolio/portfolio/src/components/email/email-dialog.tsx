import { Label, Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider/LocalizationProvider';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { type Dispatch, lazy, type SetStateAction, Suspense, useState } from 'react';
import waiting from '../../assets/swirly-dots-to-chrome.webp';
import GoogleUserContextProvider from '../../contexts/contact-context';
import { contactDialogCloseButtonSxProps, emailDialogPaperProps, mainSx, subSx } from '../../styles/header-styles';
import { fullSizeBlock } from '../../styles/pages-styles';
import { flexColumnStyles } from '../../styles/pages-styles';

const EmailForm = lazy(() => import('./email-form/email-form'));
const GoogleCalendar = lazy(() => import('./google-calendar/google-calendar'));

interface EmailDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const EmailDialog = ({ open, setOpen }: EmailDialogProps) => {
  const [tab, setTab] = useState<number>(0);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        localeText={enUS.components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <GoogleUserContextProvider>
          <Dialog
            open={open}
            id="email-dialog"
            data-testid="email-dialog"
            fullWidth
            scroll="body"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            slotProps={{ paper: emailDialogPaperProps as any }}
          >
            <Box
              component={'section'}
              id="email-me-title-box"
              data-testid="email-me-title-box"
              sx={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...(fullSizeBlock as any),
                ...flexColumnStyles
              }}
            >
              <Tabs
                variant="fullWidth"
                aria-label="contact-tabs"
                id="contact-tabs"
                data-testid="contact-tabs"
                component={'nav'}
                key={'contact-tabs'}
                value={tab}
                onChange={(_e, tab) => setTab(tab)}
              >
                <Tab
                  key={'appointment-request-tab'}
                  id="appointment-request-tab"
                  data-testid="appointment-request-tab"
                  label={
                    <Label
                      tooltipTitle={'Add to Google Calendar'}
                      labelVariant={'h3'}
                      labelText={'Appt. Request'}
                      placement={'bottom'}
                      labelTextsx={mainSx}
                      tooltipSx={subSx}
                    />
                  }
                />
                <Tab
                  key={'email-me-tab'}
                  id="email-me-tab"
                  data-testid="email-me-tab"
                  label={
                    <Label
                      tooltipTitle={'Send Email / Upload Appointment Details'}
                      labelVariant={'h3'}
                      labelText={'Email Me'}
                      placement={'bottom'}
                      labelTextsx={mainSx}
                      tooltipSx={subSx}
                    />
                  }
                />
              </Tabs>
              <Box
                component={'section'}
                key={'calendar-and-email-section'}
                id="calendar-and-email-section"
                data-testid="calendar-and-email-section"
                sx={{ ...flexColumnStyles, flex: 4 }}
              >
                <Suspense fallback={<Waiting src={waiting} />}>
                  {tab === 0 && <GoogleCalendar setOpen={setOpen} />}
                  {tab === 1 && <EmailForm setOpen={setOpen} />}
                </Suspense>
              </Box>
              <DialogActions
                key={'email-me-button-box'}
                id="email-me-button-box"
                data-testid="email-me-button-box"
                sx={{ paddingX: 4, height: 'fit-content' }}
              >
                <Button
                  type="button"
                  id="close-email-me-button"
                  data-testid="close-email-me-button"
                  onClick={() => setOpen(false)}
                  sx={contactDialogCloseButtonSxProps}
                >
                  Close
                </Button>
              </DialogActions>
            </Box>
          </Dialog>
        </GoogleUserContextProvider>
      </LocalizationProvider>
    </GoogleOAuthProvider>
  );
};

export default EmailDialog;
