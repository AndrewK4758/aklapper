import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { enUS } from '@mui/x-date-pickers/locales';
import cssBaselineStyles, {
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  MAIN_COLOR,
  MAIN_CONTRAST,
  SECONDARY_COLOR,
  SECONDARY_CONTRAST,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from './base/base_styles';
import './main-styles.css';

const Theme: ThemeType = createTheme(
  {
    palette: {
      background: {
        default: BACKGROUND_DEFAULT,
        paper: BACKGROUND_PAPER,
      },
      primary: {
        main: MAIN_COLOR,
        contrastText: MAIN_CONTRAST,
      },
      secondary: {
        main: SECONDARY_COLOR,
        contrastText: SECONDARY_CONTRAST,
      },
      text: {
        primary: TEXT_PRIMARY,
        secondary: TEXT_SECONDARY,
      },
    },
    cssVariables: true,
    shape: {
      borderRadius: 10,
    },
    typography: {
      allVariants: {
        letterSpacing: 2,
        wordSpacing: 3.5,
      },
      body1: {
        letterSpacing: 1.5,
        wordSpacing: 1,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: cssBaselineStyles,
      },
    },
  },
  enUS,
);

export default Theme;
