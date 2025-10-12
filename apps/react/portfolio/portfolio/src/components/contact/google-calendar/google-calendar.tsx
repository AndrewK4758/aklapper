import { CenteredFlexDiv } from '@aklapper/react-shared';
import Grid from '@mui/material/Grid';
import axios from 'axios';
import { useEffect, useReducer, type ActionDispatch, type FC, type ReactElement } from 'react';
import Calendar from '../../calendar/calendar';
import GoogleAuthButton from './google_auth_button';
import GoogleCalendarForm from './google_calendar_form';

export interface GoogleCalendarProps {
  setOpen: () => void;
}

type GoogleCalendarReducerProps = {
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  events: unknown[];
};

const initState: GoogleCalendarReducerProps = {
  isAuthenticated: false,
  isAuthenticating: false,
  events: [],
};

type Actions =
  | { type: typeof Action.AUTHENTICATED | typeof Action.AUTHENTICATING; payload: boolean }
  | { type: typeof Action.EVENTS; payload: unknown[] };

const Action = Object.freeze({
  AUTHENTICATING: 'AUTHENTICATING',
  AUTHENTICATED: 'AUTHENTICATED',
  EVENTS: 'EVENTS',
});

const calendarReducer = (state: GoogleCalendarReducerProps, action: Actions): GoogleCalendarReducerProps => {
  const { type, payload } = action;

  switch (type) {
    case Action.AUTHENTICATED: {
      return { ...state, isAuthenticated: payload };
    }
    case Action.AUTHENTICATING: {
      return { ...state, isAuthenticating: payload };
    }
    case Action.EVENTS: {
      return { ...state, events: payload };
    }
    default: {
      return { ...state };
    }
  }
};

const GoogleCalendar: FC<GoogleCalendarProps> = ({ setOpen }): ReactElement<GoogleCalendarProps> => {
  const [state, dispatch] = useReducer(calendarReducer, initState);
  const { isAuthenticated, isAuthenticating } = state;

  const handleAuthenticating = (isAuth: boolean) => {
    dispatch({ type: Action.AUTHENTICATING, payload: isAuth });
  };

  useEffect(() => {
    if (isAuthenticated) {
      getEvents(dispatch);
    }
  }, []);

  return (
    <CenteredFlexDiv data-testid='google-calendar-wrapper'>
      <GoogleAuthButton isAuthenticating={isAuthenticating} handleIsAuthenticating={handleAuthenticating} />
      <Grid container={true} width={'100%'}>
        <Grid size={4}>
          <GoogleCalendarForm setOpen={setOpen} />
        </Grid>
        <Grid size={8}>
          <Calendar />
        </Grid>
      </Grid>
    </CenteredFlexDiv>
  );
};

export default GoogleCalendar;

const BASE_URL = import.meta.env.VITE_PORTFOLIO_API_URL;

async function getEvents(dispatch: ActionDispatch<[action: Actions]>) {
  const resp = await axios.get(`${BASE_URL}/events`, { withCredentials: true });

  console.log(resp);
  const { events } = resp.data;

  dispatch({ type: Action.EVENTS, payload: events });
}
