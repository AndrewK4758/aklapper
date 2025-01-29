import createTheme from '@mui/material/styles/createTheme';
import type { Theme as MuiTheme } from '@mui/material/styles';

const Theme: MuiTheme = createTheme({
  palette: {
    background: {
      default: '#333539',
      paper: '#111316'
    },

    text: {
      primary: '#dddad8',
      secondary: '#eeebe9',
      disabled: '#ffb9b6'
    },

    divider: '#eeebe9'
  },

  components: {
    MuiButton: {
      defaultProps: { sx: { fontSize: '2rem' } }
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
});

export default Theme;
