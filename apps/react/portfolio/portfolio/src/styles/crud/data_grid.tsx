import type { SxProps } from '@mui/material/styles';
import CRUD_THEME from '../themes/crud_theme';

export const allDataGridsWrapperSxProps: SxProps = {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  [CRUD_THEME.breakpoints.down('lg')]: {
    flexDirection: 'column',
    alignContent: 'flex-start',
  },
  gap: 0.5,
  border: 5,
};

export const artistsSxProps: SxProps = {
  flex: '0 1 50%',
  [CRUD_THEME.breakpoints.down('lg')]: {
    flex: '0 1 100%',
  },
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  border: '3px solid purple',
  borderRadius: 1,
  maxWidth: '100%',
};

export const artistOutletWrapperSxProps: SxProps = {
  flex: '0 1 100%',
  [CRUD_THEME.breakpoints.down('lg')]: { flex: '0 1 50%' },
};
