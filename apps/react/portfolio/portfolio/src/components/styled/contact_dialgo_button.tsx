import Button, { type ButtonProps } from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const ContactDialogButton: ComponentType<ButtonProps> = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  fontWeight: 600,
  textTransform: 'none',
  color: theme.palette.primary.dark,
  borderColor: theme.palette.primary.dark,
}));

export default ContactDialogButton;
