import type { PickerValue } from '@mui/x-date-pickers/internals';
import axios from 'axios';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Form } from 'react-router';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import DateInput from './date_input.js';
import SubmitCalendarEventAction from './submit_calendar_event_action.js';
import TimeInput from './time_input.js';

const tomorrow = dayjs().add(1, 'day');

const minTime = tomorrow.set('hour', 8).set('minutes', 30);
const maxTime = tomorrow.set('hour', 19).set('minutes', 30);

export type TimesAndDates = {
  startTime: Dayjs;
  endTime: number;
  date: Dayjs;
};

export const initState: TimesAndDates = {
  startTime: minTime,
  endTime: 0,
  date: tomorrow,
};

interface GoogleAppointmentFormProps {
  setOpen: () => void;
}

export default function GoogleCalendarForm({ setOpen }: GoogleAppointmentFormProps) {
  const [values, setValues] = useState<TimesAndDates>(initState);

  const handleSetTimeAndDateValues = (pickerValue: PickerValue | number, key: keyof TimesAndDates) => {
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
        <DateInput tomorrow={tomorrow} dateValue={values.date} setDate={handleSetTimeAndDateValues} />
        <TimeInput
          minTime={minTime}
          maxTime={maxTime}
          values={values}
          handleSetTimeAndDateValues={handleSetTimeAndDateValues}
        />
        <SubmitCalendarEventAction />
      </CenteredFlexDiv>
    </Form>
  );
}

//TODO - move to services directory
const baseURL = import.meta.env.VITE_PORTFOLIO_API_URL;

const handleSubmitEvent = async (
  { date, startTime, endTime }: TimesAndDates,
  setOpen: (isOpen: boolean) => void,
): Promise<void> => {
  try {
    if (date && startTime && endTime) {
      const endTimeFormatted = startTime.add(endTime, 'minutes');

      const startDateTime = startTime.toISOString();
      const endDateTime = endTimeFormatted.toISOString();

      const result = await axios.post(
        `${baseURL}/create-events`,
        { start: startDateTime, end: endDateTime },
        {
          withCredentials: true,
        },
      );

      if (result) setOpen(false);
    }
  } catch (error) {
    console.error(error);
    alert('Error submitting event, Please try again');
  }
};
