import type { SxProps } from '@mui/material/styles';
import SvgIcon from '@mui/material/SvgIcon';

interface AiIconProps {
  sx: SxProps;
}

const AiIcon = ({ sx }: AiIconProps) => (
  <SvgIcon sx={sx}>
    <svg xmlns="http://www.w3.org/2000/svg" id="ai-icon" data-name="ai icon" viewBox="0 0 24 24" fill="#3a3c41">
      <path d="m24,7v-2h-2c0-1.654-1.346-3-3-3V0h-2v2h-2V0h-2v2h-2V0h-2v2h-2V0h-2v2c-1.654,0-3,1.346-3,3H0v2h2v2H0v2h2v2H0v2h2v2H0v2h2v3h3v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h3v-3h2v-2h-2v-2h2v-2h-2v-2h2v-2h-2v-2h2Zm-12.746,9h-3.43l-.232,1h-2.053l1.939-8.362c.287-1.237,1.625-2.008,2.937-1.458.627.263,1.049.866,1.202,1.528l1.922,8.291h-2.053l-.232-1Zm3.746-9h2v10h-2V7Zm-5.348,2.09l1.138,4.91h-2.503l1.138-4.91c.012-.053.059-.09.113-.09s.101.037.113.09Z" />
    </svg>
  </SvgIcon>
);

export default AiIcon;
