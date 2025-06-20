import Box, { type BoxProps } from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const StyledRootComponentWrapper: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: theme.spacing(2),
  padding: theme.spacing(4),
}));

export default StyledRootComponentWrapper;
