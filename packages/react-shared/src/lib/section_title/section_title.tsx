import { css, styled, type BaseDefaultProps, type PolymorphicComponent, type SxProp } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import { type SxProps, type TypographyVariant } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { CSSProperties, ReactElement } from 'react';

const StyledSectionTitle: PolymorphicComponent<SxProp, BaseDefaultProps> = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

interface SectionTitleProps {
  title: string;
  id?: string;
  variant?: TypographyVariant;
  Icon?: ReactElement;
  sx?: SxProps;
  overrideThemeStyles?: CSSProperties;
}

export default function SectionTitle({
  title,
  id,
  variant = 'body1',
  Icon,
  sx,
  overrideThemeStyles,
}: SectionTitleProps): ReactElement<SectionTitleProps> {
  const hasIcon = !!Icon;

  const titleComponent = hasIcon ? (
    <Box id={id} className={css({ display: 'flex', alignItems: 'center' })}>
      <Typography variant={variant} sx={sx} style={overrideThemeStyles}>
        {title}
      </Typography>
      <Box>{Icon}</Box>
    </Box>
  ) : (
    <Typography id={id} variant={variant} sx={sx} style={overrideThemeStyles}>
      {title}
    </Typography>
  );

  return <StyledSectionTitle>{titleComponent}</StyledSectionTitle>;
}

export { SectionTitle, StyledSectionTitle };
export type { SectionTitleProps };
