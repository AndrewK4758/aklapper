import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import dayjs from 'dayjs/esm';
import type { FormikProps } from 'formik';
import '../../../styles/mui_data_grid_and_date_picker.css';
import Theme from '../../../styles/themes/theme';
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
      disabled={formik.isSubmitting}
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
      sx={{
        backgroundColor: Theme.palette.background.default,
        borderRadius: Theme.shape.borderRadius,
        color: Theme.palette.primary.dark,
      }}
      slotProps={{
        actionBar: {
          sx: {
            borderTop: `1px solid ${Theme.palette.primary.dark}`,
            color: Theme.palette.primary.dark,
            '& .MuiButton-text': {
              color: Theme.palette.primary.dark,
            },
          },
        },
        openPickerButton: {
          sx: { color: Theme.palette.secondary.dark },
        },
        switchViewIcon: {
          sx: {
            color: Theme.palette.secondary.dark,
          },
        },
        rightArrowIcon: {
          sx: {
            color: Theme.palette.secondary.dark,
          },
        },
        leftArrowIcon: {
          sx: {
            color: Theme.palette.secondary.dark,
          },
        },
        textField: {
          InputProps: {
            slotProps: {
              notchedOutline: { sx: { borderColor: Theme.palette.primary.dark } },
            },
          },
        },
        day: {
          sx: {
            fontSize: '1.1rem',
            backgroundColor: Theme.palette.background.default,
            color: Theme.palette.primary.dark,
            borderRadius: Theme.shape.borderRadius,
            '&.MuiPickersDay-root.Mui-selected': {
              color: Theme.palette.primary.dark,
              background: Theme.palette.secondary.dark,
            },
          },
        },
        calendarHeader: {
          sx: {
            color: Theme.palette.primary.dark,
          },
        },
      }}
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
