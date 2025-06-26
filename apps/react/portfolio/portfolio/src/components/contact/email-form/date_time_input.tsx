import Box from '@mui/material/Box';
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import dayjs from 'dayjs';
import type { FormikProps } from 'formik';
import {
  BACKGROUND_ALT,
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  BASE_BORDER_RADIUS,
  BOX_SHADOW_SECONDARY_DARK,
  MAIN_COLOR_DARK,
  MULT_BORDER_RADIUS,
} from '../../../styles/base/base_styles';
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
        slotProps={{
          actionBar: {
            actions: ['accept', 'cancel'],
            sx: {
              borderTop: `1px solid ${MAIN_COLOR_DARK}`,
              backgroundColor: BACKGROUND_DEFAULT,
              borderBottomLeftRadius: BASE_BORDER_RADIUS,
              borderBottomRightRadius: BASE_BORDER_RADIUS,
            },
          },
          day: {
            sx: {
              borderRadius: MULT_BORDER_RADIUS - 0.45,
              color: MAIN_COLOR_DARK,
              backgroundColor: BACKGROUND_PAPER,
            },
          },
          desktopPaper: {
            sx: {
              boxShadow: BOX_SHADOW_SECONDARY_DARK,
              backgroundColor: BACKGROUND_DEFAULT,
            },
          },
          digitalClockItem: {
            sx: {
              backgroundColor: BACKGROUND_PAPER,
            },
          },
          leftArrowIcon: {
            sx: {
              color: MAIN_COLOR_DARK,
            },
          },
          openPickerIcon: {
            sx: {
              color: MAIN_COLOR_DARK,
              fontSize: '2rem',
            },
          },
          popper: {
            popperOptions: {
              placement: 'auto-end',
            },
          },
          rightArrowIcon: {
            sx: {
              color: MAIN_COLOR_DARK,
            },
          },
          textField: {
            sx: {
              width: '100%',
              backgroundColor: BACKGROUND_ALT,
              borderRadius: MULT_BORDER_RADIUS,
            },
          },
        }}
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
