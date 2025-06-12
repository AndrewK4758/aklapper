import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const StyledIconTooltip: ComponentType<TooltipProps> = styled(Tooltip)(({ theme }) => ({
  fontSize: '2rem',
  [theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
  },
}));

export default StyledIconTooltip;
