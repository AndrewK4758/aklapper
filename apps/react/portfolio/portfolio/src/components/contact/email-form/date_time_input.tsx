import Box from '@mui/material/Box';
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import dayjs from 'dayjs';
import type { FormikProps } from 'formik';
import type { MessageMeFormValues } from './email-form';

const tomorrow = dayjs().add(1, 'day');
const nextYear = tomorrow.add(1, 'year');

const minTime = dayjs().set('hour', 8).set('minute', 30);
const maxTime = dayjs().set('hour', 20).set('minute', 30);

interface AppointmentMakerProps {
  formik: FormikProps<MessageMeFormValues>;
  name: 'date';
}

export default function DateAndTimeInput({ formik, name }: AppointmentMakerProps) {
  return (
    <Box
      component={'section'}
      key={'appointment-maker-wrapper'}
      id='appointment-maker-wrapper'
      data-testid='appointment-maker-wrapper'
    >
      <DateTimePicker
        label={'Date & Time'}
        name={name}
        formatDensity='spacious'
        viewRenderers={{
          hours: renderTimeViewClock,
          minutes: renderTimeViewClock,
          meridiem: renderTimeViewClock,
        }}
        disableIgnoringDatePartForTimeValidation
        value={formik.values.date}
        minDate={tomorrow}
        maxDate={nextYear}
        minTime={minTime}
        maxTime={maxTime}
        orientation={'landscape'}
        onChange={async dateAndTime => await handleAppointmentAccept(dateAndTime, formik, name)}
      />
    </Box>
  );
}

async function handleAppointmentAccept(
  dateAndTime: PickerValue,
  formik: FormikProps<MessageMeFormValues>,
  fieldName: 'date',
) {
  if (dateAndTime) await formik.setFieldValue(fieldName, dateAndTime, true);
}
