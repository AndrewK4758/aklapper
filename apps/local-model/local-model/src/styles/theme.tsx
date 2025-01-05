import { createTheme } from '@mui/material';

const Theme = createTheme({
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
