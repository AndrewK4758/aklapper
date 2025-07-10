import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';

export const StyledCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  textAlign: 'center',
  borderRadius: theme.shape.borderRadius,
  width: '100%',
}));
