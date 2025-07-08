import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';

export const CenteredFlexDiv = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(8),
  padding: theme.spacing(4),
}));
