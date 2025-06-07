import type { Theme as ThemeType } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { enUS } from '@mui/x-date-pickers/locales';
import './main-styles.css';

const darkScrollbarGlobal = {
  '&::-webkit-scrollbar': {
    width: '0.75rem',
  },
  '&::-webkit-scrollbar-track': {
    background: `linear-gradient(to bottom, #ffd300, #ff3d00)`,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#3a3c41',
    borderRadius: '2px',
  },
};

const Theme: ThemeType = createTheme(
  {
    palette: {
      background: {
        default: '#333333',
        paper: '#111321',
      },
      secondary: {
        main: '#d500f9',
        contrastText: '#ffd300',
      },
      text: {
        primary: '#eef0ff',
      },
    },
    // defaultColorScheme: 'dark',
    // colorSchemes: {
    //   dark: {
    //     palette: {
    //       AppBar: {
    //         darkBg: '#212121',
    //         defaultBg: '#121212',
    //         darkColor: '#121212',
    //       },
    //       background: {
    //         default: '#121212',
    //         paper: '#707070',
    //       },
    //       text: {
    //         primary: '#eef0ff',
    //         secondary: '#cfd0dd',
    //       },
    //     },
    //   },
    //   light: {
    //     palette: {
    //       background: {
    //         paper: '#fefbf9',
    //         default: '#efedea',
    //       },
    //     },
    //   },
    // },
    cssVariables: true,
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: 'League Gothic',
      allVariants: {
        letterSpacing: 2,
        wordSpacing: 3.5,
      },
      body1: {
        fontFamily: 'Lucida',
        letterSpacing: 1.5,
        wordSpacing: 1,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ...darkScrollbarGlobal,
          width: '100vw',
          height: 'auto',
          minHeight: 'fit-content',
          display: 'flex',
          flexDirection: 'column',
        },
      },
      // MuiButton: {
      //   defaultProps: {
      //     sx: {
      //       fontSize: '2rem',
      //     },
      //   },
      // },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: '1rem' } }, defaultProps: { sx: { fontSize: '2rem' } } },
    },
  },
  enUS,
);

export default Theme;
