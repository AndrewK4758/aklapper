import Typography, { type TypographyProps } from '@mui/material/Typography';
import type { ReactElement, ReactNode } from 'react';

export interface TextProps extends TypographyProps {
  children: ReactNode;
}

export const Text: ({ children }: TextProps) => ReactElement = ({ children, ...props }: TextProps) => (
  <Typography {...props}>{children}</Typography>
);

export default Text;
