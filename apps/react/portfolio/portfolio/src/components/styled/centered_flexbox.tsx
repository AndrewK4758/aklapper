import Box, { type BoxProps } from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const CenteredFlexDiv: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(4),
  padding: theme.spacing(4),
}));

export default CenteredFlexDiv;
