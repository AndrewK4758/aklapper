import type { SxProps } from '@mui/material/styles';
import Theme from './theme';

//--------EMAIL ME---------//

export const subSx: SxProps = {
  fontSize: '1.25rem',
  color: Theme.palette.text.primary,
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.875rem',
  },
};
export const mainSx: SxProps = {
  fontSize: '2.2rem',
  color: Theme.palette.primary.dark,
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.875rem',
  },
};

export const emailStackSxProps: SxProps = {
  flex: '1 0 100%',
  justifyContent: 'space-evenly',
  gap: 4,
  paddingTop: 4,
  [Theme.breakpoints.down('md')]: {
    paddingTop: 2,
    gap: 1.5,
  },
};

export const emailButtonSxProps: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const dialogActionsStyles: SxProps = {
  flex: '0 1 45%',
  display: 'flex',
  alignItems: 'flex-end',
};

// export const textFieldSlotProps = {
//   inputLabel: {
//     sx: {
//       fontSize: '1.5rem',
//       color: Theme.palette.primary.dark,
//       [Theme.breakpoints.down('md')]: {
//         fontSize: '1rem',
//       },
//     } as SxProps,
//   },
//   htmlInput: {
//     sx: {
//       fontSize: '1.5rem',
//       paddingTop: 2,
//       backgroundColor: Theme.palette.background.default,
//       color: Theme.palette.background.paper,
//     } as SxProps,
//   },
//   input: {
//     inputProps: {
//       sx: {
//         borderRadius: 1,
//         color: Theme.palette.text.primary,
//         backgroundColor: Theme.palette.background.default,
//       },
//     },
//   },
// };
