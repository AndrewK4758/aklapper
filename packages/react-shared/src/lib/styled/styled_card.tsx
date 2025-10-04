import { styled } from '@mui/material/styles';
import Box, { type BoxProps } from '@mui/material/Box';
import type { ComponentType } from 'react';

export const StyledCard: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  textAlign: 'center',
  borderRadius: theme.shape.borderRadius,
  width: '100%',
}));
