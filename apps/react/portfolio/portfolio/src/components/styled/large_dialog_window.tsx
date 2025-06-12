import Dialog, { type DialogProps } from '@mui/material/Dialog';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const LargeStyledDialog: ComponentType<DialogProps> = styled(Dialog)(({ theme }) => ({
  backdropFilter: 'blur(10px)',
  border: 10,
  gap: theme.spacing(2),
}));
export default LargeStyledDialog;
