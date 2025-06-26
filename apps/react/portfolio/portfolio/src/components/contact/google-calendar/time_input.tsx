import { SectionTitle } from '@aklapper/react-shared';
import { TimePicker } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import {
  BACKGROUND_ALT,
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  BASE_BORDER_RADIUS,
  BOX_SHADOW_SECONDARY_DARK,
  MAIN_COLOR_DARK,
  MULT_BORDER_RADIUS,
} from '../../../styles/base/base_styles';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import EndTimeSelect from './end_time_select.js';
import type { TimesAndDates } from './google_calendar_form.js';

interface AppointmenTimesSelectorsProps {
  minTime: Dayjs;
  maxTime: Dayjs;
  values: TimesAndDates;
  handleSetTimeAndDateValues: (data: PickerValue | number, key: keyof TimesAndDates) => void;
}

export default function TimeInput({
  minTime,
  maxTime,
  values,
  handleSetTimeAndDateValues,
}: AppointmenTimesSelectorsProps) {
  return (
    <CenteredFlexDiv component={'section'} id='time-pickers-wrapper' data-testid='time-pickers-wrapper'>
      <SectionTitle
        title='Suggested Meeting Time'
        // tooltipTitle='Time must be between 8:30am and 8:00pm EST. Start & End time must be minimun of 1 hour range'
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
        slotProps={{
          desktopPaper: {
            sx: {
              backgroundColor: BACKGROUND_DEFAULT,
              boxShadow: BOX_SHADOW_SECONDARY_DARK,
            },
          },
          digitalClockSectionItem: {
            divider: true,
            sx: {
              borderRadius: MULT_BORDER_RADIUS - 0.35,
              backgroundColor: BACKGROUND_PAPER,
            },
          },
          actionBar: {
            sx: {
              borderTop: `2px solid ${MAIN_COLOR_DARK}`,
              background: BACKGROUND_DEFAULT,
              borderBottomLeftRadius: BASE_BORDER_RADIUS,
              borderBottomRightRadius: BASE_BORDER_RADIUS,
            },
          },
          textField: {
            sx: {
              width: '100%',
              backgroundColor: BACKGROUND_ALT,
              borderRadius: MULT_BORDER_RADIUS,
            },
          },
          openPickerIcon: {
            sx: {
              color: MAIN_COLOR_DARK,
              fontSize: '2rem',
            },
          },
        }}
      />
      <EndTimeSelect values={values} setEndTime={handleSetTimeAndDateValues} />
    </CenteredFlexDiv>
  );
}
