import type { PickerValue } from '@mui/x-date-pickers/internals';
import axios from 'axios';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Form } from 'react-router';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import AppointmentDateSelector from './date_selector.js';
import SubmitCalendarEventButton from './submit_calendar_event_button.js';
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
  endTime: minTime,
  date: tomorrow,
};

interface GoogleAppointmentFormProps {
  setOpen: () => void;
}

export default function GoogleCalendarForm({ setOpen }: GoogleAppointmentFormProps) {
  const [values, setValues] = useState<TimesAndDates>(initState);

  const handleSetTimeAndDateValues = (pickerValue: PickerValue, key: keyof TimesAndDates) => {
    setValues(prev => ({ ...prev, [key]: pickerValue }));
  };

  return (
    <Form
      className='contact-form'
      id='google-calendar-event-form'
      data-testid='google-calendar-event-form'
      onSubmit={() => handleSubmitEvent(values, setOpen)}
    >
      <CenteredFlexDiv
        component={'section'}
        id='google-calendar-form-box'
        data-testid='google-calendar-form-box'
        gap={2}
      >
        <AppointmentDateSelector tomorrow={tomorrow} dateValue={values.date} setDate={handleSetTimeAndDateValues} />
        <AppointmenTimesSelectors
          minTime={minTime}
          maxTime={maxTime}
          values={values}
          handleSetTimeAndDateValues={handleSetTimeAndDateValues}
        />
        <SubmitCalendarEventButton />
      </CenteredFlexDiv>
    </Form>
  );
}

//TODO - move to services directory
const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

const handleSubmitEvent = async ({ date, startTime, endTime }: TimesAndDates, setOpen: (isOpen: boolean) => void) => {
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
