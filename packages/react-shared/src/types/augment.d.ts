import type { ComponentsPropsList } from '@mui/material-pigment-css';
import type { Theme } from '@mui/material/styles';
import type { ExtendTheme } from '@pigment-css/react';
import type {} from '@pigment-css/react/theme';

declare module '@pigment-css/react/theme' {
  export interface ThemeArgs {
    theme: ExtendTheme<{
      colorScheme: 'light' | 'dark';
      tokens: Theme;
    }>;
  }
}

declare global {
  namespace React {
    interface HTMLAttributes {
      sx?: SxProps<Theme>;
    }
    interface SVGProps {
      sx?: SxProps<Theme>;
    }
  }
}

declare module '@mui/material-pigment-css' {
  /**
   * Augments the `ComponentsPropsList` interface from Pigment CSS.
   * This allows you to provide `defaultProps` for MUI X components
   * in your theme and have them be type-safe.
   */
  export interface ComponentsPropsList {
    MuiDateCalendar: DateCalendarProps<Dayjs>;
    MuiTimePicker: TimePickerProps<Dayjs>;
    MuiDateTimePicker: DateTimePickerProps<Dayjs>;
    MuiTimeClock: TimeClockProps<Dayjs>;
    MuiDataGrid: DataGridProps;
  }
}
interface ThemeArgs {
  theme: Theme;
}

// (Recommended) Also augment the core `@mui/material/styles` module
// to provide full type-safety for styleOverrides.
declare module '@mui/material/styles' {
  export interface Components {
    MuiDateCalendar?: {
      defaultProps?: ComponentsPropsList['MuiDateCalendar'];
      styleOverrides?: ComponentsOverrides<Theme>['MuiDateCalendar'];
    };
    MuiTimePicker?: {
      defaultProps?: ComponentsPropsList['MuiTimePicker'];
      styleOverrides?: ComponentsOverrides<Theme>['MuiTimePicker'];
    };
    MuiDateTimePicker?: {
      defaultProps?: ComponentsPropsList['MuiDateTimePicker'];
      styleOverrides?: ComponentsOverrides<Theme>['MuiDateTimePicker'];
    };
    MuiTimeClock?: {
      defaultProps?: ComponentsPropsList['MuiTimeClock'];
      styleOverrides?: ComponentsOverrides<Theme>['MuiTimeClock'];
    };
    MuiDataGrid?: {
      defaultProps?: ComponentsPropsList['MuiDataGrid'];
      styleOverrides?: ComponentsOverrides<Theme>['MuiDataGrid'];
    };
  }
}
