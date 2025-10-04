import { CenteredFlexDiv } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
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
  isAuthenticated: true,
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

  // const handleAuthenticated = (isAuth: boolean) => {
  //   dispatch({ type: Action.AUTHENTICATED, payload: isAuth });
  // };

  const handleAuthenticating = (isAuth: boolean) => {
    dispatch({ type: Action.AUTHENTICATING, payload: isAuth });
  };

  useEffect(() => {
    if (isAuthenticated) {
      getEvents(dispatch);
    }
  }, []);

  console.log(state);
  return (
    <CenteredFlexDiv
      data-testid='google-calendar-wrapper'
      sx={{ padding: 0, gap: 0, border: '2px solid brown', height: '100%' }}
    >
      <GoogleAuthButton isAuthenticating={isAuthenticating} handleIsAuthenticating={handleAuthenticating} />
      <Box sx={{ display: 'flex', border: '2px solid', width: '100%', height: '100%' }}>
        <GoogleCalendarForm setOpen={setOpen} />
        <Calendar />
      </Box>
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
