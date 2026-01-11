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
  BUTTON_GROUP_BG,
  MAIN_COLOR,
  MAIN_COLOR_DARK,
  SECONDARY_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@styles/base/base_styles.js';

const Theme: ThemeType = createTheme(
  {
    cssVariables: true,
    modularCssLayers: true,
    palette: {
      background: {
        default: BACKGROUND_DEFAULT,
        paper: BACKGROUND_PAPER,
      },
      primary: {
        main: MAIN_COLOR,
      },
      secondary: {
        main: SECONDARY_COLOR,
      },
      text: {
        primary: TEXT_PRIMARY,
        secondary: TEXT_SECONDARY,
      },
    },
    shape: {
      borderRadius: BASE_BORDER_RADIUS,
    },
    spacing: BASE_SPACING,
    typography: {
      allVariants: {
        fontFamily: 'Roboto, sans-serif',
        letterSpacing: '1px',
        wordSpacing: 1.5,
        lineHeight: 1.5,
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
      MuiCssBaseline: {
        styleOverrides: {
          background: `linearGradient(225deg, #e9e9eb24 0%, transparent 80%),
    linear-gradient(45deg, #10101038 0%, transparent 80%) #404040`,
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            display: 'flex',
            gap: BASE_SPACING * 6,
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
          root: {
            backgroundColor: BUTTON_GROUP_BG,
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

// for (const key in Theme.breakpoints.values) {
//   document.documentElement.style.setProperty(
//     `--mui-breakpoint-${key}`,
//     `${Theme.breakpoints.values[key as keyof typeof Theme.breakpoints.values]}px`,
//   );
// }

export default Theme;
