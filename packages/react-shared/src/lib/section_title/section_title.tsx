import { styled, type BaseDefaultProps, type PolymorphicComponent, type SxProp } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import { type SxProps, type TypographyVariant } from '@mui/material/styles';
import type { TooltipProps } from '@mui/material/Tooltip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

const StyledSectionTitle: PolymorphicComponent<SxProp, BaseDefaultProps> = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

interface SectionTitleProps {
  title: string;
  id?: string;
  variant?: TypographyVariant;
  tooltipTitle?: ReactNode;
  placement?:
    | 'bottom'
    | 'left'
    | 'right'
    | 'top'
    | 'bottom-end'
    | 'bottom-start'
    | 'left-end'
    | 'left-start'
    | 'right-end'
    | 'right-start'
    | 'top-end'
    | 'top-start'
    | undefined;
  TooltipProps?: Omit<TooltipProps, 'title' | 'placement'>;
  titleSx?: SxProps;
  Icon?: ReactElement;
  style?: CSSProperties;
}

export default function SectionTitle({
  title,
  titleSx,
  id,
  variant = 'body1',
  tooltipTitle,
  placement,
  TooltipProps,
  Icon,
  style,
}: SectionTitleProps): ReactElement<SectionTitleProps> {
  const hasTooltip = !!tooltipTitle;
  const hasIcon = !!Icon;

  const titleComponent = hasIcon ? (
    <Box id={id} sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant={variant} style={style}>
        {title}
      </Typography>
      <Box>{Icon}</Box>
    </Box>
  ) : (
    <Typography id={id} variant={variant} sx={titleSx}>
      {title}
    </Typography>
  );

  return (
    <StyledSectionTitle>
      {hasTooltip ? (
        <Tooltip {...TooltipProps} title={tooltipTitle} placement={placement}>
          {titleComponent}
        </Tooltip>
      ) : (
        titleComponent
      )}
    </StyledSectionTitle>
  );
}

export { SectionTitle, StyledSectionTitle };
export type { SectionTitleProps };
