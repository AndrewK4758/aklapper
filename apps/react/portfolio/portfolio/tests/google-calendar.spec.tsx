import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS } from '@mui/x-date-pickers/locales';
import { GoogleOAuthProvider } from '@react-oauth/google';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { createBrowserRouter, RouterProvider } from 'react-router';
import GoogleCalendar from '../src/components/email/google-calendar/google-calendar';
import GoogleUserContextProvider from '../src/contexts/contact-context';

let tomorrowsDate: string;

describe('Test GoogleCalendar Component', () => {
  beforeEach(() => {
    const router = createBrowserRouter([
      {
        path: '/',
        element: (
          <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}>
            <GoogleUserContextProvider>
              <LocalizationProvider
                dateAdapter={AdapterDayjs}
                localeText={enUS.components.MuiLocalizationProvider.defaultProps.localeText}
              >
                <GoogleCalendar setOpen={bool => bool} />
              </LocalizationProvider>
            </GoogleUserContextProvider>
          </GoogleOAuthProvider>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
    tomorrowsDate = dayjs().add(1, 'day').date().toString();
  });

  it('Should render tomorrows date on load', async () => {
    const selectedDay = await screen.findByRole('gridcell', { selected: true });

    expect(selectedDay).toHaveTextContent(tomorrowsDate);
  });

  // it('Should render 8:30am on load', async () => {
  //   const startTime = await screen.findByTestId('start-time-picker');

  //   console.log(startTime);

  //   const setTime = dayjs().set('hour', 8).set('minute', 30).format('hh:mm A');

  //   expect(startTime).toHaveValue(setTime);
  // });

  // it('Should render 9:30am on load', async () => {
  //   const endTime = await screen.findByTestId('end-time-picker');

  //   const setTime = dayjs().set('hour', 9).set('minute', 30).format('hh:mm A');

  //   expect(endTime).toHaveValue(setTime);
  // });
});
