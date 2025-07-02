import Box from '@mui/material-pigment-css/Box';
import { styled } from '@pigment-css/react';

const StyledRootComponentWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: theme.spacing(2),
  padding: theme.spacing(4),
}));

// StyledRootComponentWrapper.displayName = 'Styled Root Component Wrapper';
export default StyledRootComponentWrapper;
