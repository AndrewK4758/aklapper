import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { enUS } from '@mui/x-date-pickers/locales';

const Theme: ThemeType = createTheme(
  {
    cssVariables: false,
    modularCssLayers: false,
    colorSchemes: {
      dark: {},
      light: {},
    },
  },
  enUS,
  //   shape: {
  //     borderRadius: BASE_BORDER_RADIUS,
  //   },
  //   spacing: BASE_SPACING,
  //   typography: {
  //     allVariants: {
  //       fontFamily: 'Roboto, sans-serif',
  //       letterSpacing: '1px',
  //       wordSpacing: 1.5,
  //       lineHeight: 1.5,
  //     },
  //     h1: {
  //       fontFamily: 'League Gothic',
  //       fontSize: '8rem',
  //     },
  //     body1: {
  //       letterSpacing: 1.5,
  //       wordSpacing: 1,
  //     },
  //   },
  //   components: {
  //     MuiCssBaseline: {
  //       styleOverrides: {
  //         backgroundColor: 'white',
  //         background: `linearGradient(225deg, #e9e9eb24 0%, transparent 80%),
  //         linear-gradient(45deg, #10101038 0%, transparent 80%) #404040`,
  //         backgroundAttachment: 'fixed',
  //         backgroundRepeat: 'no-repeat',
  //       },
  //     },
  //     MuiCardContent: {
  //       styleOverrides: {
  //         root: {
  //           display: 'flex',
  //           gap: BASE_SPACING * 6,
  //         },
  //       },
  //     },
  //
  //     MuiDivider: {
  //       styleOverrides: {
  //         root: {
  //           backgroundColor: MAIN_COLOR_DARK,
  //         },
  //       },
  //     },
  //     MuiButtonGroup: {
  //       defaultProps: {
  //         fullWidth: true,
  //         variant: 'text',
  //       },
  //       styleOverrides: {
  //         root: {
  //           backgroundColor: BUTTON_GROUP_BG,
  //         },
  //       },
  //     },
  //     MuiMenuItem: {
  //       styleOverrides: {
  //         root: {
  //           backgroundColor: BACKGROUND_ALT,
  //         },
  //       },
  //     },
  //     MuiStack: {
  //       defaultProps: {
  //         useFlexGap: true,
  //         gap: 1,
  //       },
  //     },
  //   },
  // },
);

export default Theme;
