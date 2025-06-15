import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import dayjs from 'dayjs';
import type { FormikProps } from 'formik';

const tomorrow = dayjs().add(1, 'day');
const nextYear = dayjs().set(
  'year',
  2026,
); /**typeof window !== 'undefined' ? dayjs().year(new Date().getFullYear() + 1) :  */

interface AppointmentMakerProps<T> {
  formik: FormikProps<T>;
  name: Extract<keyof T, string>;
}

export default function DateAndTimeInput<T>({ formik, name }: AppointmentMakerProps<T>) {
  return (
    <DateTimePicker
      ampm={true}
      ampmInClock={true}
      name={name}
      formatDensity='spacious'
      viewRenderers={{
        hours: renderTimeViewClock,
        minutes: renderTimeViewClock,
        meridiem: renderTimeViewClock,
      }}
      defaultValue={tomorrow}
      label={'Date & Time'}
      minDate={tomorrow}
      maxDate={nextYear}
      disablePast={true}
      orientation={'landscape'}
      onAccept={async dateAndTime => await handleAppointmentAccept<T>(dateAndTime, formik)}
    />
  );
}

async function handleAppointmentAccept<T>(dateAndTime: PickerValue, formik: FormikProps<T>) {
  if (dateAndTime) await formik.setFieldValue('date', dateAndTime.toISOString(), true);
}
