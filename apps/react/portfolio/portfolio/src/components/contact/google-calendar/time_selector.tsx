import { SectionTitle } from '@aklapper/react-shared';
import { TimePicker } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import EndTimeSelect from './end_time_select.js';
import type { TimesAndDates } from './google_calendar_form.js';

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
    <CenteredFlexDiv component={'section'} id='time-pickers-wrapper' data-testid='time-pickers-wrapper'>
      <SectionTitle
        title='Suggested Meeting Time'
        tooltipTitle='Time must be between 8:30am and 8:00pm EST. Start & End time must be minimun of 1 hour range'
        placement='top-start'
        id='time-pickers-label'
        variant='h5'
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
      <EndTimeSelect startTime={values.startTime} setEndTime={handleSetTimeAndDateValues} />
    </CenteredFlexDiv>
  );
}
