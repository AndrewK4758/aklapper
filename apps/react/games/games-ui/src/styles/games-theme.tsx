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
  __textSecondary,
  __warningDark,
  __warningLight,
  __warningMain,
  __white
} from './colors';
import './styles.css';

export const GamesTheme = createTheme({
  palette: {
    mode: 'dark',

    primary: {
      main: __primaryMain,
      light: __primaryLight,
      dark: __primaryDark,
      contrastText: __greyDark
    },

    secondary: {
      main: __secondaryMain,
      light: __secondaryLight,
      dark: __secondaryDark,
      contrastText: __white
    },

    error: {
      main: __errorMain,
      light: __errorLight,
      dark: __errorDark,
      contrastText: __white
    },

    warning: {
      main: __warningMain,
      light: __warningLight,
      dark: __warningDark,
      contrastText: __white
    },

    info: {
      main: __infoMain,
      light: __infoLight,
      dark: __infoDark,
      contrastText: __greyDark
    },

    success: {
      main: __successMain,
      light: __successLight,
      dark: __successDark,
      contrastText: __white
    },

    background: {
      default: __greyDark,
      paper: __greyPaper
    },

    text: {
      primary: __white,
      secondary: __textSecondary,
      disabled: __greyLight
    },

    divider: __greyLight
  },
  typography: {
    fontFamily: 'Pixel-Game',
    h1: {
      fontFamily: 'Jersey25-Charted',
      color: __secondaryMain
    },
    h2: {
      color: __secondaryLight
    },
    body1: {
      fontFamily: 'Press-Start'
    },
    button: {
      fontFamily: 'Jersey25-Charted',
      fontSize: '2rem'
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        fontSize: '2rem',

        '&::-webkit-scrollbar': {
          width: '1rem',
          borderRadius: 1
        },
        '&::-webkit-scrollbar-track': {
          background: __greyDark,
          borderRadius: 1
        },
        '&::-webkit-scrollbar-thumb': {
          background: __greyLight,
          '&:hover': {
            background: __textSecondary
          }
        },
        '&::-webkit-scrollbar-button': {
          background: __greyPaper,
          height: '1rem',
          '&:hover': {
            background: __textSecondary
          }
        },

        scrollbarWidth: 'thin',
        scrollbarColor: `${__greyLight} ${__greyDark}`
      }
    },
    MuiButton: {
      styleOverrides: {
        startIcon: {
          color: 'inherit'
        }
      },
      defaultProps: {
        sx: { fontSize: '2rem' }
      }
    }
  }
});
