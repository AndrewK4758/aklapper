import Box from '@mui/material-pigment-css/Box';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs/esm';
import { BACKGROUND_DEFAULT, MAIN_COLOR_DARK } from '../../../styles/base/base_styles';
import type { TimesAndDates } from './google_calendar_form.js';

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
              color: MAIN_COLOR_DARK,
            },
          },
          rightArrowIcon: {
            sx: {
              color: MAIN_COLOR_DARK,
            },
          },
          leftArrowIcon: {
            sx: {
              color: MAIN_COLOR_DARK,
            },
          },
          day: {
            sx: {
              '& .t193e277': {
                background: MAIN_COLOR_DARK,
              },
              fontSize: '1.25rem',
              backgroundColor: BACKGROUND_DEFAULT,
              color: MAIN_COLOR_DARK,
            },
          },
        }}
      />
    </Box>
  );
}
