import { styled } from '@mui/material/styles';
import Box, { type BoxProps } from '@mui/material/Box';
import type { ComponentType } from 'react';

export const ColoredBackground: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: 0,
  borderRadius: theme.shape.borderRadius,
}));
