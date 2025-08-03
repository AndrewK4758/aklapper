import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useState } from 'react';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';
import type { TimesAndDates } from '../../../types/types';

interface EndTimeProps {
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

  return (
    <FormControl {...props} sx={{ width: '13rem' }}>
      <InputLabel id='length-of-meeting-label'>Length of meeting</InputLabel>
      <Select
        label='Length of meeting'
        labelId='length-of-meeting-label'
        id='select-minutes'
        onChange={hanndleSelectMeetingLength}
        value={values.endTime}
        error={error}
        slotProps={{
          notchedOutline: {
            style: { borderColor: Theme.palette.primary.dark },
          },
          input: {
            sx: {
              backgroundColor: BACKGROUND_DEFAULT,
            },
          },
        }}
        sx={{
          '.MuiSelect-iconOutlined': {
            color: Theme.palette.secondary.dark,
          },
        }}
      >
        <MenuItem divider value={15} sx={{ color: Theme.palette.primary.dark }}>
          15 Minutes
        </MenuItem>
        <MenuItem divider value={30} sx={{ color: Theme.palette.primary.dark }}>
          30 Minutes
        </MenuItem>
        <MenuItem divider value={45} sx={{ color: Theme.palette.primary.dark }}>
          45 Minutes
        </MenuItem>
        <MenuItem divider value={60} sx={{ color: Theme.palette.primary.dark }}>
          60 Minutes
        </MenuItem>
        <MenuItem divider value={90} sx={{ color: Theme.palette.primary.dark }}>
          90 Minutes
        </MenuItem>
      </Select>
    </FormControl>
  );
}
