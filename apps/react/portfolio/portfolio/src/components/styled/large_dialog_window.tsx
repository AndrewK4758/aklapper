import Dialog, { type DialogProps } from '@mui/material/Dialog';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const LargeStyledDialog: ComponentType<DialogProps> = styled(Dialog)<DialogProps>(() => ({
  backdropFilter: 'blur(0.5rem)',
}));
export default LargeStyledDialog;
