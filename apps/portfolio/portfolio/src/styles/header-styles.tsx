import type { SxProps } from '@mui/material/styles';
import { centerFlex } from './pages-styles';
import { flexColumnStyles } from './prompt-builder-styles';
import Theme from './theme';
import type { PaperProps } from '@mui/material/Paper';

export const socialMediaLinksWrapper: SxProps = {
  ...centerFlex,
  flex: '1 0 100%',
  height: '8vh'
};

export const navbarToolbarSxProps: SxProps = { display: 'flex', flexDirection: 'row', height: '100%' };

export const buttonSXProps: SxProps = {
  flex: 1,
  fontSize: '1.5rem'
};

export const menuOpenIconSxProps: SxProps = { scale: 2, paddingLeft: 0.5, width: 'fit-content' };

//--------CONNECT---------//

export const iconWrapperSxProps: SxProps = {
  ...flexColumnStyles,
  height: '100%',
  width: '8vw',
  maxWidth: '100px',
  overflow: 'hidden'
};

export const iconSxProps: SxProps = {
  display: 'flex',
  justifyContent: 'center',
  alignContent: 'center',
  width: '100%',
  height: 'fit-content',
  '&:hover': {
    cursor: 'auto',
    background: 'none'
  }
};

export const drawerPaperProps: PaperProps = { sx: { height: '92vh', top: '8vh' } };

export const contactButtonSxProps: SxProps = {
  height: '100%',
  width: '100%',
  p: 0,
  '&:hover': {
    background: 'none'
  }
};

export const contactTooltipSxProps: SxProps = { fontSize: '1rem' };

export const iconSize: SxProps = { width: '100%', height: 'auto' };

//-------GOOGLE CALENDAR--------//

export const timePickerSxProps: SxProps = { fontSize: '1.25rem' };

//--------EMAIL ME---------//

export const dialogActionsStyles: SxProps = {
  flex: '0 1 45%',
  display: 'flex',
  alignItems: 'flex-end'
};

export const textFieldSlotProps = {
  inputLabel: { sx: { fontSize: '1.5rem', color: Theme.palette.primary.dark } as SxProps },
  htmlInput: {
    sx: {
      fontSize: '1.5rem',
      paddingTop: 2,
      backgroundColor: Theme.palette.background.default,
      color: Theme.palette.background.paper
    } as SxProps
  },
  input: {
    inputProps: {
      sx: {
        borderRadius: 1,
        color: Theme.palette.text.primary,
        backgroundColor: Theme.palette.background.default
      }
    }
  }
};
