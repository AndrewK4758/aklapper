import { CenteredFlexDiv, SectionTitle } from '@aklapper/react-shared';
import { TimePicker } from '@mui/x-date-pickers';
import type { PickerValue } from '@mui/x-date-pickers/internals';
import type { Dayjs } from 'dayjs';
import Theme from '../../../styles/themes/theme';
import type { TimesAndDates } from '../../../types/types';
import EndTimeSelect from './end_time_select.js';

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
      <SectionTitle title='Suggested Meeting Time' id='time-pickers-label' variant='h5' />
      <TimePicker
        enableAccessibleFieldDOMStructure={false}
        data-testid={'start-time-picker'}
        label={'Start'}
        minTime={minTime}
        maxTime={maxTime}
        defaultValue={minTime}
        closeOnSelect={false}
        onAccept={data => handleSetTimeAndDateValues(data, 'startTime')}
        sx={{
          backgroundColor: Theme.palette.background.default,
          borderRadius: Theme.shape.borderRadius,
        }}
        slotProps={{
          desktopPaper: {
            sx: {
              padding: Theme.spacing(1),
            },
          },
        }}
      />
      <EndTimeSelect values={values} setEndTime={handleSetTimeAndDateValues} />
    </CenteredFlexDiv>
  );
}
