import { SxProp } from '@mui/material-pigment-css';
import CRUD_THEME from '../themes/crud_theme';

export const allDataGridsWrapperSxProps: SxProp = {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  [CRUD_THEME.breakpoints.down('lg')]: {
    flexDirection: 'column',
    alignContent: 'flex-start',
  },
  gap: 0.5,
};

export const artistsSxProps: SxProp = {
  flex: '0 1 50%',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  border: '3px solid purple',
  borderRadius: 1,
  maxWidth: '100%',
};

export const artistOutletWrapperSxProps: SxProp = {
  flex: '0 1 100%',
  width: '100%',
  [CRUD_THEME.breakpoints.down('lg')]: { flex: '0 1 100%' },
};
