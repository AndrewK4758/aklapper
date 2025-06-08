import type { SxProps, TypographyVariant } from '@mui/material/styles';
import Typography, { type TypographyProps } from '@mui/material/Typography';
import type { ElementType, ReactNode } from 'react';

export interface TextProps extends TypographyProps {
  variant: TypographyVariant | 'inherit';
  id?: string;
  children: ReactNode;
  sx?: SxProps;
  component?: ElementType;
}

export const Text = ({ children, id, sx, ...props }: TextProps) => (
  <Typography {...props} sx={sx} data-testid={id}>
    {children}
  </Typography>
);

export default Text;
