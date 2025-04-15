import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { enUS } from '@mui/x-date-pickers/locales';
import './main-styles.css';

const darkScrollbarGlobal = {
  '&::-webkit-scrollbar': {
    width: '16px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1f1f1f',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#3a3c41',
    borderRadius: '4px',
  },
};

const Theme: ThemeType = createTheme(
  {
    colorSchemes: {
      dark: {
        palette: {
          AppBar: {
            darkBg: '#212121',
            defaultBg: '#121212',
            darkColor: '#121212',
          },
          background: {
            default: '#121212',
            paper: '#212121',
          },
          text: {
            primary: '#ffffff',
            secondary: '#eeeeee',
          },
        },
      },
      light: {
        palette: {
          background: {
            paper: '#fefbf9',
            default: '#efedea',
          },
        },
      },
    },
    cssVariables: true,
    palette: {
      secondary: {
        main: '#d500f9',
        contrastText: '#ffd300',
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: 'League Gothic',
      allVariants: {
        letterSpacing: 2,
        wordSpacing: 3.5,
      },
      body1: {
        fontFamily: 'Lucida',
        letterSpacing: 2.0,
        wordSpacing: 1.5,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ...darkScrollbarGlobal,
        },
      },
      MuiButton: {
        defaultProps: {
          sx: {
            fontSize: '2rem',
          },
        },
      },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: '1rem' } }, defaultProps: { sx: { fontSize: '2rem' } } },
    },
  },
  enUS,
);

export default Theme;
