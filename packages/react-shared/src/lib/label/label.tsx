import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import type { TypographyVariant } from '@mui/material/styles';
import { type SxProps } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { forwardRef, type JSX, type ReactNode } from 'react';

const labelWrapperSxProps: SxProps = {
  gap: 2,
  flex: '0 1 100%'
};

const iconAndChildrenSxProps: SxProps = { display: 'flex', justifyItems: 'center', alignContent: 'center' };

export interface LabelProps {
  tooltipTitle: ReactNode;
  labelVariant: TypographyVariant;
  labelText: string;
  labelTextSx?: SxProps;
  labelWrapperDivSxProps?: SxProps;
  tooltipSx?: SxProps;
  id: string;
  placement:
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
  Icon?: JSX.Element | undefined;
  children?: ReactNode | ReactNode[];
  htmlFor: string;
}

export const Label = forwardRef<HTMLDivElement, LabelProps>(
  (
    {
      labelText,
      // labelVariant,
      placement,
      id,
      labelTextSx,
      tooltipSx,
      tooltipTitle,
      Icon,
      children,
      htmlFor,
      labelWrapperDivSxProps = labelWrapperSxProps
    },
    ref
  ) => (
    <Box component={'section'} key={`${id}-wrapper-box`} id={`${id}-wrapper-box`}>
      <Box component={'div'} key={`${id}-box`} id={`${id}-box`} sx={labelWrapperDivSxProps}>
        <Tooltip
          id={`${id}-tooltip`}
          key={`${id}-tooltip`}
          ref={ref}
          describeChild={true}
          placement={placement}
          title={tooltipTitle}
          slotProps={{ tooltip: { sx: tooltipSx } }}
        >
          <InputLabel
            is="label"
            htmlFor={htmlFor}
            key={`${id}-label-text`}
            id={`${id}-label-text-id`}
            variant="outlined"
            sx={labelTextSx}
          >
            {labelText}
          </InputLabel>
        </Tooltip>
        {Icon && (
          <Box component={'div'} key={`${id}-icon`} id={`${id}-icon`} sx={iconAndChildrenSxProps}>
            {Icon}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  )
);

export default Label;
