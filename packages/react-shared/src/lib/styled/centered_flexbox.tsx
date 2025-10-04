import { styled } from '@mui/material/styles';
import Box, { type BoxProps } from '@mui/material/Box';
import type { ComponentType } from 'react';

export const CenteredFlexDiv: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(8),
  padding: theme.spacing(4),
}));
