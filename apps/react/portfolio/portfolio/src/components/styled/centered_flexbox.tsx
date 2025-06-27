import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';

const CenteredFlexDiv = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(12),
  padding: theme.spacing(4),
}));

export default CenteredFlexDiv;
