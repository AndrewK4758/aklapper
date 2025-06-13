import { SectionTitle } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import { TimePicker } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import { timePickerWrapperSxProps } from '../../../styles/header-styles';
import type { TimesAndDates } from './google-calendar';

interface AppointmenTimesSelectorsProps {
  minTime: Dayjs;
  maxTime: Dayjs;
  values: TimesAndDates;
  handleSetTimeAndDateValues: (data: PickerValue, key: keyof TimesAndDates) => void;
}

export default function AppointmenTimesSelectors({
  minTime,
  maxTime,
  values,
  handleSetTimeAndDateValues,
}: AppointmenTimesSelectorsProps) {
  return (
    <Box
      component={'section'}
      id='time-pickers-wrapper'
      data-testid='time-pickers-wrapper'
      sx={timePickerWrapperSxProps}
    >
      <SectionTitle
        title='Suggested Meeting Time'
        tooltipTitle='Time must be between 8:30am and 8:00pm EST. Start & End time must be minimun of 1 hour range'
        placement='top-start'
        id='time-pickers-label'
        variant='h4'
      />
      <TimePicker
        data-testid={'start-time-picker'}
        label={'Start'}
        minTime={minTime}
        maxTime={maxTime}
        defaultValue={minTime}
        closeOnSelect={false}
        onAccept={data => handleSetTimeAndDateValues(data, 'startTime')}
      />
      <TimePicker
        data-testid={'end-time-picker'}
        label={'End'}
        minTime={values.startTime.add(1, 'hour')}
        maxTime={values.startTime.add(3, 'hours')}
        closeOnSelect={false}
        onAccept={data => handleSetTimeAndDateValues(data, 'endTime')}
      />
    </Box>
  );
}
