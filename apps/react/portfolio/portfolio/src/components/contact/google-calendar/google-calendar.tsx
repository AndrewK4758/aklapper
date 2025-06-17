import type { ReactElement } from 'react';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import GoogleAuthButton from './google_auth_button.js';
import GoogleCalendarForm from './google_calendar_form.js';

export interface GoogleCalendarProps {
  setOpen: () => void;
}

const GoogleCalendar = ({ setOpen }: GoogleCalendarProps): ReactElement<GoogleCalendarProps> => {
  return (
    <CenteredFlexDiv id='google-calendar-wrapper' data-testid='google-calendar-wrapper' p={4}>
      <GoogleAuthButton />
      <GoogleCalendarForm setOpen={setOpen} />
    </CenteredFlexDiv>
  );
};

export default GoogleCalendar;
