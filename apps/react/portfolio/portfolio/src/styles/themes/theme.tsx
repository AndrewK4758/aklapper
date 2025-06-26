import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { enUS } from '@mui/x-date-pickers/locales';
import {
  BACKGROUND_ALT,
  BACKGROUND_DEFAULT,
  BACKGROUND_PAPER,
  BASE_BORDER_RADIUS,
  BASE_SPACING,
  // BOX_SHADOW_SECONDARY_DARK,
  BUTTON_GROUP_BG,
  MAIN_COLOR,
  MAIN_COLOR_DARK,
  MAIN_COLOR_LIGHT,
  MAIN_CONTRAST,
  // MULT_BORDER_RADIUS,
  SECONDARY_COLOR,
  SECONDARY_COLOR_DARK,
  SECONDARY_COLOR_LIGHT,
  SECONDARY_CONTRAST,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../base/base_styles.js';

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
    spacing: BASE_SPACING,
    typography: {
      allVariants: {
        letterSpacing: 2,
        wordSpacing: 3.5,
        lineHeight: 1.25,
      },
      h1: {
        fontFamily: 'League Gothic',
        fontSize: '8rem',
      },
      body1: {
        letterSpacing: 1.5,
        wordSpacing: 1,
      },
    },
    components: {
      MuiCardContent: {
        styleOverrides: {
          root: {
            display: 'flex',
            gap: BASE_SPACING * 6,
          },
        },
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
            transition: {
              timeout: {
                appear: 2000,
              },
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            backgroundColor: MAIN_COLOR_DARK,
          },
        },
      },
      MuiButtonGroup: {
        defaultProps: {
          fullWidth: true,
          variant: 'text',
        },
        styleOverrides: {
          text: {
            borderRadius: '12px',
          },
          root: {
            backgroundColor: BUTTON_GROUP_BG,
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
    },
  },
  enUS,
);

export default Theme;
