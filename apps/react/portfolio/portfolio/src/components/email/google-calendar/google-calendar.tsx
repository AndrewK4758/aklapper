import { Label, Waiting } from '@aklapper/react-shared';
import GoogleIcon from '@mui/icons-material/Google';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
// import type { PickerValue } from '@mui/x-date-pickers/internals';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useGoogleLogin, type CodeResponse } from '@react-oauth/google';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { jwtDecode } from 'jwt-decode';
import { useContext, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { Form, useNavigation } from 'react-router';
import {
  GoogleUserContext,
  type GoogleUserContextInfo,
  type GoogleUserContextProps,
} from '../../../contexts/contact-context.jsx';
import {
  connectGoogleCalendarButtonSxProps,
  dateCalendarSlotProps,
  dateCalendarSxProps,
  endTimePickerSlotProps,
  startTimePickerSlotProps,
  timePickerLabelSxProps,
  timePickerSxProps,
  timePickerWrapperSxProps,
} from '../../../styles/header-styles.jsx';
import { flexColumnStyles } from '../../../styles/pages-styles.jsx';

const tomorrow = dayjs().add(1, 'day');
const nextYear = dayjs().add(1, 'year');
const minTime = tomorrow.set('hour', 8).set('minutes', 30);
const maxTime = tomorrow.set('hour', 19).set('minutes', 30);

type TimesAndDates = {
  startTime: Dayjs;
  endTime: Dayjs;
  date: Dayjs;
};

const initState: TimesAndDates = {
  startTime: minTime,
  endTime: minTime.add(1, 'hour'),
  date: tomorrow,
};

interface GoogleCalendarProps {
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const GoogleCalendar = ({ setOpen }: GoogleCalendarProps) => {
  const [values, setValues] = useState<TimesAndDates>(initState);
  const { GoogleUserContextValues, setUser } = useContext<GoogleUserContextProps>(GoogleUserContext);
  const { state } = useNavigation();

  const login = useGoogleLogin({
    onSuccess: code => onGoogleSuccess(code, setUser),
    onError: err => console.error(err),
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <Container
      component={'div'}
      key={'google-calendar-wrapper'}
      id='google-calendar-wrapper'
      data-testid='google-calendar-wrapper'
      sx={{ ...flexColumnStyles, flex: 1 }}
    >
      <Box
        component={'section'}
        key={'google-calendar-auth-box'}
        id='google-calendar-auth-box'
        data-testid='google-calendar-auth-box'
        display={'flex'}
        justifyContent={'center'}
        alignContent={'center'}
      >
        <Button
          LinkComponent={'button'}
          key={'google-auth-button'}
          id='google-auth-button'
          data-testid='google-auth-button'
          onClick={() => login()}
        >
          <Label
            id='google-auth-button-label'
            tooltipTitle={'Connect your Google Calendar to sync appointment request with your Google Calendar'}
            labelVariant={'button'}
            labelText={'Connect Google Calendar'}
            placement={'top'}
            htmlFor={'google-auth-button'}
            labelWrapperDivSxProps={{ display: 'flex', alignItems: 'center', gap: 2 }}
            labelTextSx={connectGoogleCalendarButtonSxProps}
            Icon={<GoogleIcon color='inherit' fontSize='inherit' />}
          />
        </Button>
      </Box>
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
          <Box
            component={'section'}
            key={'date-picker-wrapper'}
            id='date-picker-wrapper'
            data-testid='date-picker-wrapper'
            sx={{
              ...flexColumnStyles,
              width: '100%',
              flex: '3 1 auto',
              alignContent: 'center',
              justifyContent: 'center',
            }}
          >
            <DateCalendar
              key={'date-calendar'}
              data-testid={'date-calendar'}
              minDate={tomorrow}
              maxDate={nextYear}
              disablePast={true}
              defaultValue={tomorrow}
              value={values.date}
              onChange={data => setValues({ ...values, date: data as Dayjs })}
              slotProps={dateCalendarSlotProps}
              sx={dateCalendarSxProps}
            />
          </Box>
          <Box
            component={'section'}
            key={'time-pickers-wrapper'}
            id='time-pickers-wrapper'
            data-testid='time-pickers-wrapper'
            sx={timePickerWrapperSxProps}
          >
            <Label
              id='time-pickers-label'
              htmlFor=''
              tooltipTitle={
                'Time must be between 8:30am and 8:00pm EST. Start & End time must be minimun of 1 hour range'
              }
              labelVariant={'h4'}
              labelText={'Suggested Meeting Time'}
              placement={'top'}
              labelTextSx={timePickerLabelSxProps}
              tooltipSx={{ fontSize: '1.4rem' }}
            />
            <TimePicker
              key={'start-time-picker'}
              data-testid={'start-time-picker'}
              label={
                <Label
                  id='start-time-picker-label'
                  htmlFor='start-time-picker'
                  placement='top'
                  tooltipTitle='Enter requested appointment start time'
                  labelVariant='body1'
                  labelText='Start Time'
                  labelTextSx={timePickerSxProps}
                />
              }
              minTime={minTime}
              maxTime={maxTime}
              defaultValue={minTime}
              closeOnSelect={false}
              value={values.startTime}
              onAccept={data => setValues({ ...values, startTime: data as Dayjs })}
              slotProps={startTimePickerSlotProps}
            />
            <TimePicker
              key={'end-time-picker'}
              data-testid={'end-time-picker'}
              label={
                <Label
                  id='end-time-picker-label'
                  htmlFor='end-time-picker'
                  placement='top'
                  tooltipTitle='Enter requested appointment end time'
                  labelVariant='body1'
                  labelText='End Time'
                  labelTextSx={timePickerSxProps}
                />
              }
              minTime={values.startTime.add(1, 'hour')}
              maxTime={values.startTime.add(3, 'hours')}
              closeOnSelect={false}
              value={values.endTime}
              onAccept={data => setValues({ ...values, endTime: data as Dayjs })}
              slotProps={endTimePickerSlotProps}
            />
          </Box>
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

const onGoogleSuccess = async (code: CodeResponse, setUser: Dispatch<SetStateAction<GoogleUserContextInfo>>) => {
  try {
    const resp = await axios.post(`${baseURL}/create-tokens`, { code }, { withCredentials: true });

    let { idToken } = resp.data;

    let { email, name }: GoogleUserContextInfo = jwtDecode(idToken);

    setUser({ email: email, name: name });

    idToken = null;
    email = '';
    name = '';

    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

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
