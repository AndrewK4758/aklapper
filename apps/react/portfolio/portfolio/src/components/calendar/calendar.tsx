import Box from '@mui/material/Box';
import type { ReactElement } from 'react';
import Theme from '../../styles/themes/theme';
import CalendarLayout from './layout';

interface CalendarProps {
  width?: number | string;
  height?: number | string;
}

/**
 *
 * Handles all context and/or top level state for this component
 */
export default function Calendar(): ReactElement<CalendarProps> {
  return (
    <Box sx={{ width: '100%', height: '100%', border: `2px solid ${Theme.vars.palette.info.main}` }}>
      <CalendarLayout Header={'Calendar'}>Children</CalendarLayout>
    </Box>
  );
}
