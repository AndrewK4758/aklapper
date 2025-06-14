import type { PaperProps } from '@mui/material/Paper';
import type { SxProps } from '@mui/material/styles';
import type { DateTimePickerSlotProps } from '@mui/x-date-pickers/DateTimePicker';
import Theme from './theme';

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

export const emailDialogPaperProps: PaperProps = {
  elevation: 2,
  sx: {
    m: 0,
    minWidth: '40vw',
    width: 'fit-content',
    height: '90%',
    ' .MuiInputBase-input': {
      fontSize: '1.25rem',
    },
    [Theme.breakpoints.down('lg')]: {
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

export const dateTimePickerSlotProps: DateTimePickerSlotProps<false> = {
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
