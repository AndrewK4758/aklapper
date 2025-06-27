import { keyframes, styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import Theme from '../../styles/themes/theme';

export const spin = keyframes`
  50% {
    --clr-1: ${Theme.palette.secondary.main};
    --clr-2: ${Theme.palette.primary.main};
    --clr-1: ${Theme.palette.secondary.main};
  }`;

const AnimatedBorderBox = styled(Box)(({ theme }) => ({
  background: `conic-gradient(${theme.palette.background.paper} 0 0) padding-box,
      linear-gradient(to right, var(--clr-1), var(--clr-2), var(--clr-1)) border-box`,
  border: '3px solid transparent',
  borderRadius: '22px',
  position: 'relative',
  isolation: 'isolate',
  animation: `${spin} 2s linear infinite`,
}));

export default AnimatedBorderBox;
