import { SxProps } from '@mui/material';
import Typography from '@mui/material/Typography';
import { TypographyVariant } from '@mui/material/styles';
import { ReactNode, type ElementType } from 'react';

export interface TextProps {
  titleVariant: TypographyVariant | 'inherit';
  id?: string;
  titleText: ReactNode;
  sx?: SxProps;
  component: ElementType;
}

export const Text = ({ component, id, titleVariant, titleText, sx }: TextProps) => (
  <Typography component={component} id={id} variant={titleVariant} sx={sx} data-testid={id}>
    {titleText}
  </Typography>
);

export default Text;
