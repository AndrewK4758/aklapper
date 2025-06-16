import Card, { type CardProps } from '@mui/material/Card';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const StyledCard: ComponentType<CardProps> = styled(Card)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  textAlign: 'center',
  borderRadius: theme.shape.borderRadius,
}));

export default StyledCard;
