import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import dayjs from 'dayjs/esm';
import type { FormikProps } from 'formik';
import { BACKGROUND_DEFAULT, BASE_BORDER_RADIUS } from '../../../styles/base/base_styles';
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
    <DateTimePicker
      enableAccessibleFieldDOMStructure={false}
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
      sx={{ backgroundColor: BACKGROUND_DEFAULT, borderRadius: BASE_BORDER_RADIUS }}
    />
  );
}

async function handleAppointmentAccept(
  dateAndTime: PickerValue,
  formik: FormikProps<MessageMeFormValues>,
  fieldName: 'date',
) {
  if (dateAndTime) await formik.setFieldValue(fieldName, dateAndTime, true);
}
