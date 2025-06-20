import { createTheme } from '@mui/material/styles';
import { BASE_BORDER_RADIUS } from '../base/base_styles';

const CRUD_THEME = createTheme({
  palette: {
    background: {
      default: '#D2D2D2',
    },
    text: {
      primary: '#000000',
      secondary: '#222222',
    },
  },
  shape: {
    borderRadius: BASE_BORDER_RADIUS,
  },
});

export default CRUD_THEME;
