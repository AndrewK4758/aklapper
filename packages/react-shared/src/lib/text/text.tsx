import Typography, { type TypographyProps } from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface TextProps extends TypographyProps {
  children: ReactNode;
}

export const Text = ({ children, ...props }: TextProps) => <Typography {...props}>{children}</Typography>;

export default Text;
