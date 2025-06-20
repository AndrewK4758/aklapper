import Button, { type ButtonProps } from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const BaseStyledButton: ComponentType<ButtonProps> = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  textTransform: 'none',
}));

export default BaseStyledButton;
