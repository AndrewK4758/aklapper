import '@mui/material/styles';
import '@mui/x-data-grid';
import '@mui/x-date-pickers';
import type { Dayjs } from 'dayjs';

declare module '@mui/material/styles' {
  interface Components {
    MuiDateCalendar?: {
      defaultProps: import('@mui/x-date-pickers/DateCalendar').DateCalendarProps<Dayjs>;
      styleOverrides?: import('@mui/material/styles').ComponentsOverrides<Theme>['MuiDateCalendar'];
    };

    MuiTimePicker?: {
      defaultProps?: import('@mui/x-date-pickers/TimePicker').TimePickerProps;
      styleOverrides?: import('@mui/material/styles').ComponentsOverrides<Theme>['MuiTimePicker'];
    };

    MuiDataGrid?: {
      defaultProps?: import('@mui/x-data-grid').DataGridProps;
      styleOverrides?: import('@mui/material/styles').ComponentsOverrides<Theme>['MuiDataGrid'];
    };

    MuiDateTimePicker?: {
      defaultProps?: import('@mui/x-date-pickers').DateTimePickerProps;
      styleOverrides?: import('@mui/material/styles').ComponentsOverrides<Theme>['MuiDateTimePicker'];
    };

    MuiTimeClock?: {
      defaultProps?: import('@mui/x-date-pickers').TimeClockProps;
      styleOverrides?: import('@mui/material/styles').ComponentsOverrides<Theme>['MuiTimeClock'];
    };
  }
}
