import { Label } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import type { FormikProps } from 'formik';
import { dateTimePickerLabelTextSxProps, dateTimePickerSlotProps } from '../../../styles/header-styles.jsx';
import Theme from '../../../styles/theme.jsx';
import { MessageMeFormValues } from '../email-form/email-form.jsx';

const tomorrow = dayjs().add(1, 'day');
const nextYear = dayjs().year(new Date().getFullYear() + 1);

interface AppointmentMakerProps {
  formik: FormikProps<MessageMeFormValues>;
}

const AppointmentMaker = ({ formik }: AppointmentMakerProps) => (
  <Box component={'div'} key={'google-calendar-wrapper'} id="google-calendar-wrapper">
    <DateTimePicker
      key={'appointment-maker'}
      name="appointment-maker"
      formatDensity="spacious"
      viewRenderers={{
        hours: renderTimeViewClock,
        minutes: renderTimeViewClock
      }}
      defaultValue={tomorrow}
      label={
        <Label
          htmlFor="appointment-maker"
          placement="top"
          tooltipTitle={
            'Select a data and time to set an appointment with me. I will receive an email with the request and confirm with you via the email you provide. '
          }
          labelVariant="body1"
          labelText="Set Appointment Date Time"
          labelTextSx={dateTimePickerLabelTextSxProps}
        />
      }
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
