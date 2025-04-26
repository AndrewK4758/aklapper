import { createTheme } from '@mui/material/styles';
import {
  __errorDark,
  __errorLight,
  __errorMain,
  __greyDark,
  __greyLight,
  __greyPaper,
  __infoDark,
  __infoLight,
  __infoMain,
  __primaryDark,
  __primaryLight,
  __primaryMain,
  __secondaryDark,
  __secondaryLight,
  __secondaryMain,
  __successDark,
  __successLight,
  __successMain,
  __textPrimary,
  __textSecondary,
  __warningDark,
  __warningLight,
  __warningMain,
} from './colors';
import './styles.css';

export const GamesTheme = createTheme({
  palette: {
    mode: 'dark',

    primary: {
      main: __primaryMain,
      light: __primaryLight,
      dark: __primaryDark,
      contrastText: __greyDark,
    },

    secondary: {
      main: __secondaryMain,
      light: __secondaryLight,
      dark: __secondaryDark,
      contrastText: __textPrimary,
    },

    error: {
      main: __errorMain,
      light: __errorLight,
      dark: __errorDark,
      contrastText: __textPrimary,
    },

    warning: {
      main: __warningMain,
      light: __warningLight,
      dark: __warningDark,
      contrastText: __textPrimary,
    },

    info: {
      main: __infoMain,
      light: __infoLight,
      dark: __infoDark,
      contrastText: __greyDark,
    },

    success: {
      main: __successMain,
      light: __successLight,
      dark: __successDark,
      contrastText: __textPrimary,
    },

    background: {
      default: __greyDark,
      paper: __greyPaper,
    },

    text: {
      primary: __textPrimary,
      secondary: __textSecondary,
      disabled: __greyLight,
    },

    divider: __greyLight,
  },
  typography: {
    fontFamily: 'Fira Mono',
    h1: {
      fontFamily: 'Enter Command',
      color: __greyDark,
      fontSize: '6rem',
    },
    h2: {
      fontFamily: 'Enter Command',
      color: __secondaryLight,
    },
    h3: {
      fontFamily: 'Pixel-Game',
      color: __primaryMain,
    },
    h4: {
      fontFamily: 'Enter Command',
      color: __infoMain,
    },
    body1: {
      color: __textPrimary,
    },
    button: {
      fontFamily: 'Jersey25-Charted',
      fontSize: '2rem',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '&::-webkit-scrollbar': {
          width: '1rem',
          borderRadius: 1,
        },
        '&::-webkit-scrollbar-track': {
          background: __greyDark,
          borderRadius: 1,
        },
        '&::-webkit-scrollbar-thumb': {
          background: __greyLight,
          '&:hover': {
            background: __textSecondary,
          },
        },
        '&::-webkit-scrollbar-button': {
          background: __greyPaper,
          height: '1rem',
          '&:hover': {
            background: __textSecondary,
          },
        },

        scrollbarWidth: 'thin',
        scrollbarColor: `${__greyLight} ${__greyDark}`,
      },
    },
    MuiButton: {
      styleOverrides: {
        startIcon: {
          color: 'inherit',
        },
      },
      defaultProps: {
        sx: { fontSize: '2rem' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          backgroundColor: __greyPaper,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: __greyPaper,
        },
      },
    },
  },
});
