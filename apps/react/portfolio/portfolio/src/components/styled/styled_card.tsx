import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';

const StyledCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(4, 8),
  textAlign: 'center',
  borderRadius: theme.shape.borderRadius,
  width: '100%',
}));

export default StyledCard;
