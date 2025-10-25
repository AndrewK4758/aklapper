import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs/esm';
// import Theme from '../../../styles/themes/theme';
import type { TimesAndDates } from '../../../types/types';

interface AppointmentDateSelectorProps {
  tomorrow: Dayjs;
  dateValue: TimesAndDates['date'];
  setDate: (pickerValues: PickerValue, key: keyof TimesAndDates) => void;
}

export default function DateInput({ tomorrow, dateValue, setDate }: AppointmentDateSelectorProps) {
  const nextYear = dayjs().add(1, 'year');

  return (
    <DateCalendar
      data-testid={'date-calendar'}
      minDate={tomorrow}
      maxDate={nextYear}
      disablePast={true}
      defaultValue={tomorrow}
      value={dateValue}
      onChange={data => setDate(data, 'date')}
      // slotProps={{
      //   switchViewIcon: {
      //     sx: {
      //       color: Theme.palette.secondary.dark,
      //     },
      //   },
      //   rightArrowIcon: {
      //     sx: {
      //       color: Theme.palette.secondary.dark,
      //     },
      //   },
      //   leftArrowIcon: {
      //     sx: {
      //       color: Theme.palette.secondary.dark,
      //     },
      //   },
      //   day: {
      //     sx: {
      //       fontSize: '1.25rem',
      //       backgroundColor: Theme.palette.background.default,
      //       color: Theme.palette.primary.dark,
      //       borderRadius: Theme.shape.borderRadius,
      //     },
      //   },
      // }}
      // sx={{
      //   color: Theme.palette.primary.dark,
      //   '.MuiDayCalendar-weekDayLabel': {
      //     color: Theme.palette.primary.dark,
      //   },
      //   '.MuiPickersDay, .Mui-selected': {
      //     color: Theme.palette.primary.dark,
      //     backgroundColor: Theme.palette.secondary.dark,
      //   },
      // }}
    />
  );
}
