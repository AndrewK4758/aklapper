import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import type { PickerValue } from '@mui/x-date-pickers/internals';
// import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { useContext, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { Form, useNavigation } from 'react-router';
import { GoogleUserContext, type GoogleUserContextProps } from '../../../contexts/contact-context.jsx';
// import { timePickerWrapperSxProps } from '../../../styles/header-styles.jsx';
import { flexColumnStyles } from '../../../styles/pages-styles.jsx';
import AppointmentDateSelector from './date_selector.js';
import GoogleAuthButton from './google_auth_button.js';
import AppointmenTimesSelectors from './time_selector.js';

const tomorrow = dayjs().add(1, 'day');

const minTime = tomorrow.set('hour', 8).set('minutes', 30);
const maxTime = tomorrow.set('hour', 19).set('minutes', 30);

export type TimesAndDates = {
  startTime: Dayjs;
  endTime: Dayjs;
  date: Dayjs;
};

export const initState: TimesAndDates = {
  startTime: minTime,
  endTime: minTime.add(1, 'hour'),
  date: tomorrow,
};

interface GoogleCalendarProps {
  setOpen: () => void;
}

const GoogleCalendar = ({ setOpen }: GoogleCalendarProps) => {
  const [values, setValues] = useState<TimesAndDates>(initState);
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);
  const { state } = useNavigation();

  const handleSetTimeAndDateValues = (pickerValue: PickerValue, key: keyof TimesAndDates) => {
    if (pickerValue) setValues(prev => ({ ...prev, [key]: pickerValue }));
  };

  return (
    <Container component={'div'} id='google-calendar-wrapper' data-testid='google-calendar-wrapper'>
      <GoogleAuthButton />
      <Box
        component={'section'}
        key={'google-calendar-components-box'}
        id='google-calendar-components-box'
        data-testid='google-calendar-components-box'
        sx={{
          ...flexColumnStyles,
          alignItems: 'center',
          flex: 1,
        }}
      >
        <Form
          onSubmit={() => handleSubmitEvent(values, setOpen)}
          style={{
            ...(flexColumnStyles as CSSProperties),
            width: '100%',
            flex: 1,
          }}
        >
          <AppointmentDateSelector tomorrow={tomorrow} dateValue={values.date} setDate={handleSetTimeAndDateValues} />
          <AppointmenTimesSelectors
            minTime={minTime}
            maxTime={maxTime}
            values={values}
            handleSetTimeAndDateValues={handleSetTimeAndDateValues}
          />
          <Box
            component={'section'}
            key={'google-calendar-submit-box'}
            id='google-calendar-submit-box'
            data-testid='google-calendar-submit-box'
            height={'fit-content'}
            display={'flex'}
            justifyContent={'flex-end'}
            paddingX={4}
          >
            {state !== 'submitting' && GoogleUserContextValues.name.length ? (
              <Button
                type='submit'
                LinkComponent={'button'}
                key={'calendar-submit-button'}
                id='calendar-submit-buttom'
                data-testid='calendar-submit-buttom'
              >
                Submit Event
              </Button>
            ) : null}
            {state === 'loading' && <Waiting src={'/swirly-dots-to-chrome.webp'} />}
          </Box>
        </Form>
      </Box>
    </Container>
  );
};

export default GoogleCalendar;

const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

const handleSubmitEvent = async (
  { date, startTime, endTime }: TimesAndDates,
  setOpen: Dispatch<SetStateAction<boolean>>,
) => {
  try {
    if (date && startTime && endTime) {
      const tempStartDateTime = date.toDate();
      const tempEndDateTime = date.toDate();

      const startHours = startTime.get('hours');
      const startMinutes = startTime.get('minutes');

      const endHours = endTime.get('hours');
      const endMinutes = endTime.get('minutes');

      tempStartDateTime.setHours(startHours);
      tempStartDateTime.setMinutes(startMinutes);

      tempEndDateTime.setHours(endHours);
      tempEndDateTime.setMinutes(endMinutes);

      const startDateTime = tempStartDateTime.toISOString();
      const endDateTime = tempEndDateTime.toISOString();

      const result = await axios.post(
        `${baseURL}/create-events`,
        { start: startDateTime, end: endDateTime },
        {
          withCredentials: true,
        },
      );

      if (result) setOpen(false);
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};
