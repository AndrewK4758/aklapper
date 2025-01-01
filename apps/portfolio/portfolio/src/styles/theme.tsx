import createTheme, { type Theme as ThemeType } from '@mui/material/styles/createTheme';
import { enUS } from '@mui/x-date-pickers/locales';

const darkScrollbarGlobal = {
  '&::-webkit-scrollbar': {
    width: '16px'
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1f1f1f'
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#3a3c41',
    borderRadius: '4px'
  }
};

const Theme: ThemeType = createTheme(
  {
    palette: {
      background: {
        paper: '#fefbf9',
        default: '#efedea'
      }
    },
    shape: {
      borderRadius: 10
    },
    typography: {
      allVariants: {
        fontFamily: 'League Gothic',
        letterSpacing: 3,
        wordSpacing: 3.5
      },

      body1: {
        fontFamily: 'Lucida',
        letterSpacing: 2.0,
        wordSpacing: 1.5
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: darkScrollbarGlobal }
      },
      MuiButton: {
        defaultProps: {
          sx: {
            fontSize: '2rem'
          }
        }
      },

      MuiButtonGroup: {
        defaultProps: {
          sx: {
            '& .MuiButtonGroup-grouped:not(:last-of-type)': {
              borderColor: '#eeebe9 '
            }
          }
        }
      },

      MuiTooltip: { styleOverrides: { tooltip: { fontSize: '1rem' } }, defaultProps: { sx: { fontSize: '2rem' } } }
    }
  },
  enUS
);

export default Theme;
