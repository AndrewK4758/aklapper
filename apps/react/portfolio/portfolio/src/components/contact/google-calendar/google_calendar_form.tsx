import { CenteredFlexDiv } from '@aklapper/react-shared';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import dayjs from 'dayjs';
import { useState, type ReactElement } from 'react';
import { Form } from 'react-router';
import handleSubmitCalendarEvent from '../../../services/contact/submit_calendar_event';
import type { TimesAndDates } from '../../../types/types';
import DateInput from './date_input.js';
import SubmitCalendarEventAction from './submit_calendar_event_action.js';
import TimeInput from './time_input.js';

const tomorrow = dayjs().add(1, 'day');

const minTime = tomorrow.set('hour', 8).set('minutes', 30);
const maxTime = tomorrow.set('hour', 19).set('minutes', 30);

interface GoogleAppointmentFormProps {
  setOpen: () => void;
}

export default function GoogleCalendarForm({
  setOpen,
}: GoogleAppointmentFormProps): ReactElement<GoogleAppointmentFormProps> {
  const [values, setValues] = useState<TimesAndDates>({
    startTime: minTime,
    endTime: 0,
    date: tomorrow,
  });

  const handleSetTimeAndDateValues = (pickerValue: PickerValue | number, key: keyof TimesAndDates) => {
    setValues(prev => ({ ...prev, [key]: pickerValue }));
  };

  return (
    <Form
      className='contact-form'
      id='google-calendar-event-form'
      data-testid='google-calendar-event-form'
      onSubmit={() => handleSubmitCalendarEvent(values, setOpen)}
    >
      <CenteredFlexDiv id='google-calendar-form-box' data-testid='google-calendar-form-box' sx={{ gap: 2 }}>
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
