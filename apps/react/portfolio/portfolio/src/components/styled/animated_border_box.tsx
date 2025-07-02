import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import { spin } from '../../styles/base/animations';

const AnimatedBorderBox = styled(Box)(({ theme }) => ({
  background: `conic-gradient(${theme.palette.background.paper} 0 0) padding-box,
      linear-gradient(to right, var(--clr-1), var(--clr-2), var(--clr-1)) border-box`,
  border: '3px solid transparent',
  borderRadius: '22px',
  position: 'relative',
  isolation: 'isolate',
  animation: `${spin} 2s linear infinite`,
}));

// AnimatedBorderBox.displayName = 'Animated Border';
export default AnimatedBorderBox;
