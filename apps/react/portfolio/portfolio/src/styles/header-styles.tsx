import type { PaperProps } from '@mui/material/Paper';
import type { SxProps } from '@mui/material/styles';
import type { DateCalendarSlotProps } from '@mui/x-date-pickers/DateCalendar/index.js';
import type { DateTimePickerSlotProps } from '@mui/x-date-pickers/DateTimePicker/index.js';
import type { TimePickerSlotProps } from '@mui/x-date-pickers/TimePicker/index.js';
import type { Dayjs } from 'dayjs';
import { flexColumnStyles } from './pages-styles.js';
import Theme from './theme.js';

export const headerLabelSxProps: SxProps = {
  fontSize: '2.5rem',
  [Theme.breakpoints.down('md')]: { fontSize: '1rem' },
};

//--------CONNECT---------//

export const contactIconWrapperSxProps: SxProps = {
  ...flexColumnStyles,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
};

export const iconWrapperSxProps: SxProps = {
  ...flexColumnStyles,
  height: '100%',
  width: '8vw',
  maxWidth: '100px',
  overflow: 'hidden',
  backgroundColor: '#9e9e9e',
  [Theme.breakpoints.down('md')]: {
    width: '100%',
    maxWidth: '70px',
    p: 0,
    m: 0,
  },
};

export const iconSxProps: SxProps = {
  display: 'flex',
  justifyContent: 'center',
  alignContent: 'center',
  width: '100%',
  height: 'fit-content',
  '&:hover': {
    cursor: 'auto',
    background: 'none',
  },
  [Theme.breakpoints.down('md')]: {
    p: 1,
  },
};

export const drawerPaperProps: PaperProps = {
  sx: { height: '94.5vh', top: '5.5vh', width: 'fit-content' },
};

export const contactButtonSxProps: SxProps = {
  height: '100%',
  width: '100%',
  p: 0,
  '&:hover': {
    background: 'none',
  },
};

export const contactTooltipSxProps: SxProps = { fontSize: '1rem' };

export const iconSize: SxProps = {
  width: '100%',
  height: 'auto',
};

export const contactDialogCloseButtonSxProps: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

//-------GOOGLE CALENDAR--------//

export const connectGoogleCalendarButtonSxProps: SxProps = {
  fontSize: '2rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const dateCalendarSxProps: SxProps = {
  scale: 1.4,
  [Theme.breakpoints.down('md')]: {
    scale: 1,
  },
};

export const dateCalendarSlotProps: DateCalendarSlotProps<Dayjs> = {
  switchViewIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  rightArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  leftArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  day: {
    sx: {
      fontSize: '1.5rem',
      backgroundColor: Theme.palette.background.default,
      color: Theme.palette.primary.dark,
      borderRadius: 1,
    },
  },
  calendarHeader: {
    sx: {
      scale: 1.1,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
      '& .MuiPickersCalendarHeader-label': {
        [Theme.breakpoints.down('md')]: {
          fontSize: '1rem',
        },
      },
    },
  },
};

export const startTimePickerSlotProps: TimePickerSlotProps<Dayjs, false> = {
  digitalClockSectionItem: {
    sx: {
      border: `2px solid ${Theme.palette.primary.dark}`,
      borderRadius: 1,
      backgroundColor: Theme.palette.background.default,
    },
  },
  actionBar: {
    sx: {
      borderTop: `2px solid ${Theme.palette.primary.dark}`,
    },
  },
  textField: {
    variant: 'filled',
    id: 'start-time-picker',
    sx: {
      p: 1,
      width: '80%',
      borderRadius: 1,
    },
  },
  rightArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  leftArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  openPickerIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  desktopPaper: {
    elevation: 2,
    sx: {
      border: `3px solid ${Theme.palette.primary.dark}`,
    },
  },
};

export const endTimePickerSlotProps: TimePickerSlotProps<Dayjs, false> = {
  digitalClockSectionItem: {
    sx: {
      border: `2px solid ${Theme.palette.primary.dark}`,
      borderRadius: 1,
      backgroundColor: Theme.palette.background.default,
    },
  },
  actionBar: {
    sx: {
      borderTop: `2px solid ${Theme.palette.primary.dark}`,
    },
  },
  textField: {
    variant: 'filled',
    id: 'end-time-picker',
    sx: {
      p: 1,
      width: '80%',
      borderRadius: 1,
    },
  },
  rightArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  leftArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  openPickerIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  desktopPaper: {
    elevation: 2,
    sx: {
      border: `3px solid ${Theme.palette.primary.dark}`,
    },
  },
};

export const timePickerWrapperSxProps: SxProps = {
  ...flexColumnStyles,
  flex: '1 0 auto',
  justifyContent: 'space-evenly',
  alignItems: 'center',
};

export const timePickerLabelSxProps: SxProps = {
  color: Theme.palette.primary.main,
  [Theme.breakpoints.down('md')]: { fontSize: '1rem' },
};

export const timePickerSxProps: SxProps = { fontSize: '1.25rem', color: Theme.palette.primary.main };

//--------EMAIL ME---------//

export const subSx: SxProps = {
  fontSize: '1.25rem',
  color: Theme.palette.text.primary,
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.875rem',
  },
};
export const mainSx: SxProps = {
  fontSize: '2.2rem',
  color: Theme.palette.primary.dark,
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.875rem',
  },
};

export const emailDialogPaperProps = {
  elevation: 2,
  component: 'div',
  sx: {
    m: 0,
    minWidth: '40vw',
    width: 'fit-content',
    height: '90%',
    ' .MuiInputBase-input': {
      fontSize: '1.25rem',
    },
    [Theme.breakpoints.down('md')]: {
      height: '70%',
      ' .MuiInputBase-input': {
        fontSize: '0.75rem',
      },
    },
  },
};

export const emailStackSxProps: SxProps = {
  flex: '1 0 100%',
  justifyContent: 'space-evenly',
  gap: 4,
  paddingTop: 4,
  [Theme.breakpoints.down('md')]: {
    paddingTop: 2,
    gap: 1.5,
  },
};

export const emailButtonSxProps: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const dialogActionsStyles: SxProps = {
  flex: '0 1 45%',
  display: 'flex',
  alignItems: 'flex-end',
};

export const textFieldSlotProps = {
  inputLabel: {
    sx: {
      fontSize: '1.5rem',
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        fontSize: '1rem',
      },
    } as SxProps,
  },
  htmlInput: {
    sx: {
      fontSize: '1.5rem',
      paddingTop: 2,
      backgroundColor: Theme.palette.background.default,
      color: Theme.palette.background.paper,
    } as SxProps,
  },
  input: {
    inputProps: {
      sx: {
        borderRadius: 1,
        color: Theme.palette.text.primary,
        backgroundColor: Theme.palette.background.default,
      },
    },
  },
};

export const dateTimePickerSlotProps: DateTimePickerSlotProps<Dayjs, false> = {
  textField: {
    color: 'primary',
    id: 'appointment-maker',
    variant: 'outlined',
    sx: {
      p: 1,
      width: '100%',
      borderRadius: 1,
    },
  },
  switchViewIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  rightArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  leftArrowIcon: {
    sx: {
      scale: 1.5,
      color: Theme.palette.primary.dark,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  openPickerIcon: {
    sx: {
      scale: 1.5,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  desktopPaper: {
    elevation: 2,
    sx: {
      backgroundColor: Theme.palette.background.default,
      border: `3px solid ${Theme.palette.primary.dark}`,
    },
  },
  day: {
    sx: {
      fontSize: '1.5rem',
      borderRadius: 1,
      [Theme.breakpoints.down('md')]: {
        fontSize: '1rem',
      },
    },
  },
  calendarHeader: {
    sx: {
      scale: 1.1,
      [Theme.breakpoints.down('md')]: {
        scale: 1,
      },
    },
  },
  actionBar: {
    actions: ['accept', 'clear'],
  },
};
