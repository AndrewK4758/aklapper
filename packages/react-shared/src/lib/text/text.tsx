import { SxProps } from '@mui/material';
import Typography, { type TypographyProps } from '@mui/material/Typography';
import { TypographyVariant } from '@mui/material/styles';
import { ReactNode, type ElementType } from 'react';

export interface TextProps {
  titleVariant: TypographyVariant | 'inherit';
  id?: string;
  titleText: ReactNode;
  sx?: SxProps;
  component: ElementType;
  gutterBottom?: boolean;
  TypogrpahyProps?: TypographyProps;
}

export const Text = ({ component, id, titleVariant, titleText, gutterBottom, sx, TypogrpahyProps }: TextProps) => (
  <Typography
    {...TypogrpahyProps}
    component={component}
    id={id}
    variant={titleVariant}
    sx={sx}
    gutterBottom={gutterBottom}
    data-testid={id}
  >
    {titleText}
  </Typography>
);

export default Text;
