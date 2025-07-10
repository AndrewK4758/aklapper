import { styled } from '@mui/material-pigment-css';
import Dialog, { type DialogProps } from '@mui/material/Dialog';
import type { ComponentType } from 'react';

export const LargeStyledDialog: ComponentType<DialogProps> = styled(Dialog)<DialogProps>(() => ({
  backdropFilter: 'blur(0.5rem)',
}));
