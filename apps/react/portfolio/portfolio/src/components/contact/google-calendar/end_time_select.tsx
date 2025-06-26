import FormControl, { type FormControlProps } from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useState } from 'react';
import { BACKGROUND_ALT, MAIN_COLOR_DARK } from '../../../styles/base/base_styles';
import type { TimesAndDates } from './google_calendar_form';

interface EndTimeProps extends FormControlProps {
  values: TimesAndDates;
  setEndTime: (values: number, key: 'endTime') => void;
}

export default function EndTimeSelect({ values, setEndTime, ...props }: EndTimeProps) {
  const [error, setError] = useState(false);
  const hanndleSelectMeetingLength = (e: SelectChangeEvent<number>) => {
    setEndTime(e.target.value, 'endTime');
    if (e.target.value < 15) setError(true);
    else setError(false);
  };

  // See if there is a better way to size this component without extr divs
  return (
    <FormControl {...props} sx={{ width: '13rem' }}>
      <InputLabel id='length-of-meeting-label'>Length of meeting</InputLabel>
      <Select
        autoWidth
        label='Meeting Length'
        labelId='select-minutes-label'
        id='select-minutes'
        onChange={hanndleSelectMeetingLength}
        value={values.endTime}
        error={error}
        slotProps={{
          input: {
            sx: {
              color: MAIN_COLOR_DARK,
              backgroundColor: BACKGROUND_ALT,
            },
          },
          notchedOutline: {
            sx: {
              color: MAIN_COLOR_DARK,
            },
          },
          root: {
            sx: {
              color: MAIN_COLOR_DARK,
              backgroundColor: BACKGROUND_ALT,
            },
          },
        }}
      >
        <MenuItem value={0} />

        <MenuItem divider value={15}>
          15 Minutes
        </MenuItem>
        <MenuItem divider value={30}>
          30 Minutes
        </MenuItem>
        <MenuItem divider value={45}>
          45 Minutes
        </MenuItem>
        <MenuItem divider value={60}>
          60 Minutes
        </MenuItem>
        <MenuItem divider value={90}>
          90 Minutes
        </MenuItem>
      </Select>
    </FormControl>
  );
}
