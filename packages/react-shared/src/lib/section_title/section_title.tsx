import Box, { type BoxProps } from '@mui/material/Box';
import { styled, type SxProps, type TypographyVariant } from '@mui/material/styles';
import type { TooltipProps } from '@mui/material/Tooltip';
import Tooltip from '@mui/material/Tooltip';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import Text from '../text/text';

const StyledSectionTitle: ComponentType<BoxProps> = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

interface SectionTitleProps extends BoxProps {
  title: string;
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
}

export default function SectionTitle({
  title,
  titleSx,
  variant = 'body1',
  tooltipTitle,
  placement,
  TooltipProps,
  Icon,
  ...props
}: SectionTitleProps) {
  const hasTooltip = !!tooltipTitle;
  const hasIcon = !!Icon;

  const titleComponent = hasIcon ? (
    <Box display={'flex'} alignItems={'center'}>
      <Text variant={variant} sx={titleSx}>
        {title}
      </Text>
      <Box>{Icon}</Box>
    </Box>
  ) : (
    <Text variant={variant} sx={titleSx}>
      {title}
    </Text>
  );

  return (
    <StyledSectionTitle {...props}>
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
