import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import { lazy, Suspense, type ReactElement } from 'react';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import type { EmailFormProps } from '../email-form/email-form';
import type { GoogleCalendarProps } from '../google-calendar/google-calendar';

const GoogleCalendar = lazy(() => import('../google-calendar/google-calendar'));
const EmailForm = lazy(() => import('../email-form/email-form'));

interface ContactContentProps {
  tab: number;
  handleIsOpen: () => void;
}

export default function ContactContent({ tab, handleIsOpen }: ContactContentProps): ReactElement<ContactContentProps> {
  let Element: ReactElement<GoogleCalendarProps | EmailFormProps> | null = null;

  switch (tab) {
    case 0:
      Element = <GoogleCalendar setOpen={handleIsOpen} />;
      break;
    case 1:
      Element = <EmailForm setOpen={handleIsOpen} />;
      break;
    default:
      break;
  }
  return (
    <Box as={'section'} className={css({ width: '100%' })}>
      <Suspense fallback={<Waiting src={waiting} />}>{Element}</Suspense>
    </Box>
  );
}
