import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';

const ColoredBackground = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: 0,
  borderRadius: theme.shape.borderRadius,
}));

export default ColoredBackground;
