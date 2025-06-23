import Typography, { type TypographyProps } from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface TextProps extends TypographyProps {
  // variant: TypographyVariant | 'inherit';
  // id?: string;
  children: ReactNode;
  // sx?: SxProps;
  // component?: ElementType;
}

export const Text = ({ children, ...props }: TextProps) => (
  <Typography {...props} data-testid={props.id}>
    {children}
  </Typography>
);

export default Text;
