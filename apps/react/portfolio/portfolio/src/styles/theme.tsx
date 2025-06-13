import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { enUS } from '@mui/x-date-pickers/locales';
import cssBaselineStyles, {
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  MAIN_COLOR,
  MAIN_COLOR_DARK,
  MAIN_COLOR_LIGHT,
  MAIN_CONTRAST,
  SECONDARY_COLOR,
  SECONDARY_COLOR_DARK,
  SECONDARY_COLOR_LIGHT,
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
        light: MAIN_COLOR_LIGHT,
        dark: MAIN_COLOR_DARK,
        contrastText: MAIN_CONTRAST,
      },
      secondary: {
        main: SECONDARY_COLOR,
        light: SECONDARY_COLOR_LIGHT,
        dark: SECONDARY_COLOR_DARK,
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
      MuiDialog: {
        styleOverrides: {
          paper: {
            boxShadow: `0 0 0 0.5rem ${MAIN_COLOR_DARK}3A`,
            height: '90%',
          },
        },
      },
      MuiContainer: {
        defaultProps: {
          sx: {
            padding: 4,
          },
        },
      },
      MuiDateCalendar: {
        defaultProps: {
          slotProps: {
            switchViewIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
              },
            },
            rightArrowIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
              },
            },
            leftArrowIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
              },
            },
            day: {
              sx: {
                fontSize: '1.5rem',
                backgroundColor: BACKGROUND_DEFAULT,
                color: MAIN_COLOR_DARK,
                borderRadius: 1,
              },
            },
          },
        },
      },
      MuiTimePicker: {
        defaultProps: {
          formatDensity: 'spacious',
          slotProps: {
            digitalClockSectionItem: {
              sx: {
                border: `2px solid ${MAIN_COLOR_DARK}`,
                borderRadius: 1,
                backgroundColor: BACKGROUND_DEFAULT,
              },
            },
            actionBar: {
              sx: {
                borderTop: `2px solid ${MAIN_COLOR_DARK}`,
              },
            },
            textField: {
              sx: {
                width: '80%',
                backgroundColor: BACKGROUND_DEFAULT,
                borderRadius: 1,
              },
            },
            openPickerIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
                fontSize: '2rem',
              },
            },
          },
        },
      },
    },
  },
  enUS,
);

export default Theme;
