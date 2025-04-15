import Box from '@mui/material/Box';
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import type { FormikProps } from 'formik';
import { dateTimePickerSlotProps } from '../../../styles/header-styles.jsx';
import Theme from '../../../styles/theme.jsx';
import type { MessageMeFormValues } from '../email-form/email-form.jsx';

const tomorrow = dayjs().add(1, 'day');
const nextYear = dayjs().year(new Date().getFullYear() + 1);

interface AppointmentMakerProps {
  formik: FormikProps<MessageMeFormValues>;
}

const AppointmentMaker = ({ formik }: AppointmentMakerProps) => (
  <Box component={'div'} key={'google-calendar-wrapper'} id='google-calendar-wrapper'>
    <DateTimePicker
      key={'appointment-maker'}
      name='appointment-maker'
      formatDensity='spacious'
      viewRenderers={{
        hours: renderTimeViewClock,
        minutes: renderTimeViewClock,
      }}
      defaultValue={tomorrow}
      label={'Set Appointment Date Time'}
      minDate={tomorrow}
      maxDate={nextYear}
      disablePast={true}
      orientation={Theme.breakpoints.down('lg') ? 'portrait' : 'landscape'}
      onAccept={data => {
        formik.setFieldValue('date', data?.toISOString());
      }}
      slotProps={dateTimePickerSlotProps}
    />
  </Box>
);

export default AppointmentMaker;
