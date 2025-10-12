import Box, { type BoxProps } from '@mui/material/Box';
import { styled, type SxProps, type TypographyVariant } from '@mui/material/styles';
import Typography, { type TypographyProps } from '@mui/material/Typography';
import type { ComponentType, ReactElement } from 'react';

const StyledSectionTitle: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  color: theme.palette.primary.dark,
  padding: '0 2rem',
}));

interface SectionTitleProps extends TypographyProps {
  title: string;
  id?: string;
  variant?: TypographyVariant;
  Icon?: ReactElement;
  sx?: SxProps;
}

export default function SectionTitle({
  title,
  id,
  variant = 'body1',
  Icon,
  sx,
  ...props
}: SectionTitleProps): ReactElement<SectionTitleProps> {
  const hasIcon = !!Icon;

  const titleComponent = hasIcon ? (
    <>
      <Typography {...props} variant={variant} sx={sx}>
        {title}
      </Typography>
      <Box>{Icon}</Box>
    </>
  ) : (
    <Typography {...props} id={id} variant={variant} sx={sx}>
      {title}
    </Typography>
  );

  return <StyledSectionTitle>{titleComponent}</StyledSectionTitle>;
}

export { SectionTitle, StyledSectionTitle };
export type { SectionTitleProps };
