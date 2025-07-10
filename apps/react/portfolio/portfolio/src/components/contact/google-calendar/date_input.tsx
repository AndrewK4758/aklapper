import Box from '@mui/material-pigment-css/Box';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs/esm';
import Theme from '../../../styles/themes/theme';
import type { TimesAndDates } from '../../../types/types';

interface AppointmentDateSelectorProps {
  tomorrow: Dayjs;
  dateValue: TimesAndDates['date'];
  setDate: (pickerValues: PickerValue, key: keyof TimesAndDates) => void;
}

export default function DateInput({ tomorrow, dateValue, setDate }: AppointmentDateSelectorProps) {
  const nextYear = dayjs().add(1, 'year');

  return (
    <Box as={'section'} id='date-picker-wrapper' data-testid='date-picker-wrapper'>
      <DateCalendar
        data-testid={'date-calendar'}
        minDate={tomorrow}
        maxDate={nextYear}
        disablePast={true}
        defaultValue={tomorrow}
        value={dateValue}
        onChange={data => setDate(data, 'date')}
        slotProps={{
          switchViewIcon: {
            sx: {
              color: Theme.palette.primary.dark,
            },
          },
          rightArrowIcon: {
            sx: {
              color: Theme.palette.primary.dark,
            },
          },
          leftArrowIcon: {
            sx: {
              color: Theme.palette.primary.dark,
            },
          },
          day: {
            sx: {
              '& .t193e277': {
                background: Theme.palette.primary.dark,
              },

              fontSize: '1.25rem',
              backgroundColor: Theme.palette.background.default,
              color: Theme.palette.primary.dark,
            },
          },
        }}
        sx={{
          '& .t1h8fw7e-14': {
            color: Theme.palette.primary.dark,
          },
        }}
      />
    </Box>
  );
}
