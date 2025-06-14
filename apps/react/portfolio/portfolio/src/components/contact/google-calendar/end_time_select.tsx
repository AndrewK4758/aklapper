import FormControl, { type FormControlProps } from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import type { Dayjs } from 'dayjs';

interface EndTimeProps extends FormControlProps {
  startTime: Dayjs;
  setEndTime: (values: Dayjs, key: 'endTime') => void;
}

export default function EndTimeSelect({ startTime, setEndTime, ...props }: EndTimeProps) {
  const hanndleSelectMeetingLength = (e: SelectChangeEvent) => {
    const endTime = startTime.add(parseInt(e.target.value), 'minutes');
    setEndTime(endTime, 'endTime');
  };

  // See if there is a better way to size this component without extr divs
  return (
    <FormControl {...props} sx={{ width: '13rem' }}>
      <InputLabel id='length-of-meeting-label'>Length of meeting</InputLabel>
      <Select
        autoWidth
        defaultValue=''
        label='Length of meeting'
        labelId='select-minutes-label'
        id='select-minutes'
        onChange={hanndleSelectMeetingLength}
        required
      >
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
