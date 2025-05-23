import Box from '@mui/material/Box';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

export interface TabLabelProps {
  mainVariant: TypographyVariant;
  subVariant: TypographyVariant;
  mainText: string;
  subText: string;
  mainSx?: SxProps;
  subSx?: SxProps;
  id?: string;
}

export const TabLabel = ({ id, mainVariant, mainText, mainSx, subVariant, subText, subSx }: TabLabelProps) => (
  <Box component={'section'} id={`${id}-wrapper`} data-testid={`${id}-wrapper`}>
    <Typography id={`${id}-main-text`} data-testid={`${id}-main-text`} variant={mainVariant} sx={mainSx}>
      {mainText}
    </Typography>
    <Typography id={`${id}-caption-text`} data-testid={`${id}-caption-text`} variant={subVariant} sx={subSx}>
      {subText}
    </Typography>
  </Box>
);

export default TabLabel;
