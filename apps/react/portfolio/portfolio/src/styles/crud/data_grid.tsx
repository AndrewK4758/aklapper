import type { SxProp } from '@pigment-css/react';
import { BACKGROUND_PAPER, BASE_BORDER_RADIUS } from '../base/base_styles';
import Theme from '../themes/theme';

export const allDataGridsWrapperSxProps: SxProp = {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  padding: 0,
  gap: Theme.spacing(4),
  border: 2,
  width: '100%',
};

export const artistsSxProps: SxProp = {
  flex: 1,
  gap: Theme.spacing(4),
  borderRadius: BASE_BORDER_RADIUS,
  maxWidth: '100%',
  backgroundColor: BACKGROUND_PAPER,
};

export const artistOutletWrapperSxProps: SxProp = {
  flex: '0 1 100%',
  width: '100%',
  [Theme.breakpoints.down('lg')]: { flex: '0 1 100%' },
};
