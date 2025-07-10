import { CenteredFlexDiv } from '@aklapper/react-shared';
import { css } from '@pigment-css/react';
import type { ReactElement } from 'react';
import GoogleAuthButton from './google_auth_button.js';
import GoogleCalendarForm from './google_calendar_form.js';

export interface GoogleCalendarProps {
  setOpen: () => void;
}

const GoogleCalendar = ({ setOpen }: GoogleCalendarProps): ReactElement<GoogleCalendarProps> => {
  return (
    <CenteredFlexDiv data-testid='google-calendar-wrapper' className={css({ padding: '4 0' })}>
      <GoogleAuthButton />
      <GoogleCalendarForm setOpen={setOpen} />
    </CenteredFlexDiv>
  );
};

export default GoogleCalendar;
