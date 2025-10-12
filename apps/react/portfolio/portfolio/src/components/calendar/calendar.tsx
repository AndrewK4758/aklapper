import Box from '@mui/material/Box';
import type { ReactElement } from 'react';
import CalendarLayout from './layout';

interface CalendarProps {
  width?: number | string;
  height?: number | string;
}

/**
 *
 * Handles all context and/or top level state for this component
 */

export default function Calendar({ ...props }): ReactElement<CalendarProps> {
  return (
    <Box>
      <CalendarLayout Header={'Calendar'}>{props.children}</CalendarLayout>
    </Box>
  );
}
