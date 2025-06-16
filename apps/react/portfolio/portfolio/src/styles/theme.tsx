import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { enUS } from '@mui/x-date-pickers/locales';
import cssBaselineStyles, {
  BACKGROUND_ALT,
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  BASE_BORDER_RADIUS,
  BOX_SHADOW_SECONDARY_DARK,
  MAIN_COLOR,
  MAIN_COLOR_DARK,
  MAIN_COLOR_LIGHT,
  MAIN_CONTRAST,
  MULT_BORDER_RADIUS,
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
      borderRadius: BASE_BORDER_RADIUS,
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
        defaultProps: {
          slotProps: {
            paper: {
              sx: {
                boxShadow: `0 0 0 0.5rem ${MAIN_COLOR_DARK}3A`,
                height: 'fit-content',
                minHeight: '75vh',
              },
            },
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
      MuiSelect: {
        defaultProps: {
          slotProps: {
            input: {
              sx: {
                color: MAIN_COLOR_DARK,
                backgroundColor: BACKGROUND_ALT,
              },
            },
            notchedOutline: {
              sx: {
                color: MAIN_COLOR_DARK,
              },
            },
            root: {
              sx: {
                color: MAIN_COLOR_DARK,
                backgroundColor: BACKGROUND_ALT,
              },
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            backgroundColor: BACKGROUND_ALT,
          },
        },
      },
      MuiStack: {
        defaultProps: {
          useFlexGap: true,
          gap: 1,
        },
      },
      MuiTextField: {
        defaultProps: {
          slotProps: {
            input: {
              sx: {
                backgroundColor: BACKGROUND_ALT,
                width: '100%',
              },
            },
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
                fontSize: '1.25rem',
                backgroundColor: BACKGROUND_DEFAULT,
                color: MAIN_COLOR_DARK,
              },
            },
          },
        },
      },
      MuiTimePicker: {
        defaultProps: {
          formatDensity: 'spacious',
          slotProps: {
            desktopPaper: {
              sx: {
                backgroundColor: BACKGROUND_DEFAULT,
                boxShadow: BOX_SHADOW_SECONDARY_DARK,
              },
            },
            digitalClockSectionItem: {
              divider: true,
              sx: {
                borderRadius: MULT_BORDER_RADIUS - 0.35,
                backgroundColor: BACKGROUND_PAPER,
              },
            },
            actionBar: {
              sx: {
                borderTop: `2px solid ${MAIN_COLOR_DARK}`,
                background: BACKGROUND_DEFAULT,
                borderBottomLeftRadius: BASE_BORDER_RADIUS,
                borderBottomRightRadius: BASE_BORDER_RADIUS,
              },
            },
            textField: {
              sx: {
                width: '100%',
                backgroundColor: BACKGROUND_ALT,
                borderRadius: MULT_BORDER_RADIUS,
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
      MuiDateTimePicker: {
        defaultProps: {
          ampm: true,
          slotProps: {
            actionBar: {
              actions: ['accept', 'cancel'],
              sx: {
                borderTop: `2px solid ${MAIN_COLOR_DARK}`,
                backgroundColor: BACKGROUND_DEFAULT,
                borderBottomLeftRadius: BASE_BORDER_RADIUS,
                borderBottomRightRadius: BASE_BORDER_RADIUS,
              },
            },
            day: {
              sx: {
                borderRadius: MULT_BORDER_RADIUS - 0.35,
                backgroundColor: BACKGROUND_PAPER,
              },
            },
            desktopPaper: {
              sx: {
                boxShadow: BOX_SHADOW_SECONDARY_DARK,
                backgroundColor: BACKGROUND_DEFAULT,
              },
            },
            digitalClockItem: {
              sx: {
                backgroundColor: BACKGROUND_PAPER,
              },
            },

            leftArrowIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
              },
            },
            openPickerIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
                fontSize: '2rem',
              },
            },
            popper: {
              popperOptions: {
                placement: 'auto-end',
              },
            },
            rightArrowIcon: {
              sx: {
                color: MAIN_COLOR_DARK,
              },
            },
            textField: {
              sx: {
                width: '100%',
                backgroundColor: BACKGROUND_ALT,
                borderRadius: MULT_BORDER_RADIUS,
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
