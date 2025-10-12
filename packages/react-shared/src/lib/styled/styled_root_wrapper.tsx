import Box, { type BoxProps } from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

export const StyledRootComponentWrapper: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  paddingInline: theme.spacing(4),
  paddingBlockStart: theme.spacing(4),
}));
