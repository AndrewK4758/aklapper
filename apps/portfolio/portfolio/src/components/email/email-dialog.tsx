import { TabLabel, Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import type { PaperProps } from '@mui/material/Paper';
import { type SxProps } from '@mui/material/styles';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider/LocalizationProvider';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { type Dispatch, lazy, type SetStateAction, Suspense, useState } from 'react';
import GoogleUserContextProvider from '../../contexts/contact-context';
import { fullSizeBlock } from '../../styles/pages-styles';
import { flexColumnStyles } from '../../styles/prompt-builder-styles';
import Theme from '../../styles/theme';

const EmailForm = lazy(() => import('./email-form/email-form'));
const GoogleCalendar = lazy(() => import('./google-calendar/google-calendar'));

const subSx: SxProps = { fontSize: '1.25rem', color: Theme.palette.text.primary };
const mainSx: SxProps = { fontSize: '2.2rem', color: Theme.palette.primary.dark };

const paperProps: PaperProps = {
  elevation: 24,
  component: 'div',
  sx: {
    m: 0,
    minWidth: '40vw',
    width: 'fit-content',
    height: '90%'
  }
};

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
            PaperProps={paperProps}
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
                TabIndicatorProps={{
                  sx: {
                    borderBottom: `4px solid ${Theme.palette.secondary.dark}`
                  }
                }}
                sx={{ height: 'fit-content' }}
              >
                <Tab
                  key={'appointment-request-tab'}
                  id="appointment-request-tab"
                  data-testid="appointment-request-tab"
                  label={
                    <TabLabel
                      id="appointment-request"
                      mainVariant="h3"
                      mainText="Appointment Request"
                      mainSx={mainSx}
                      subVariant="caption"
                      subText="Add to Google Calendar"
                      subSx={subSx}
                    />
                  }
                />
                <Tab
                  key={'email-me-tab'}
                  id="email-me-tab"
                  data-testid="email-me-tab"
                  label={
                    <TabLabel
                      id="email-me"
                      mainVariant="h3"
                      mainText="Email Me"
                      mainSx={mainSx}
                      subVariant="caption"
                      subText="Send Email / Upload Appointment Details"
                      subSx={subSx}
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
                <Suspense fallback={<Waiting src={'/swirly-dots-to-chrome.webp'} />}>
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
