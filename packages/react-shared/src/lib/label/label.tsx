import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { type SxProps } from '@mui/material/styles';
import type { Variant } from '@mui/material/styles/createTypography';
import Tooltip from '@mui/material/Tooltip';
import { forwardRef, type JSX, type ReactNode } from 'react';

const labelWrapperSxProps: SxProps = {
  gap: 2,
  flex: '0 1 100%'
};

const iconAndChildrenSxProps: SxProps = { display: 'flex', justifyItems: 'center', alignContent: 'center' };

export interface LabelProps {
  tooltipTitle: ReactNode;
  labelVariant: Variant;
  labelText: string;
  labelTextSx?: SxProps;
  labelWrapperDivSxProps?: SxProps;
  tooltipSx?: SxProps;
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
      labelVariant,
      placement,
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
    <Box component={'div'} key={`${labelText}-wrapper-box`} id={`${labelText}-wrapper-box`}>
      <Box component={'div'} key={`${labelText}-box`} id={`${labelText}-box`} sx={labelWrapperDivSxProps}>
        <Tooltip
          id={`${labelText}-tooltip`}
          key={`${labelText}-tooltip`}
          ref={ref}
          describeChild={true}
          placement={placement}
          title={tooltipTitle}
          slotProps={{ tooltip: { sx: tooltipSx } }}
        >
          <Typography
            component={'label'}
            is="label"
            htmlFor={htmlFor}
            variant={labelVariant}
            key={`${labelText}-label-text`}
            id={`${labelText}-label-text`}
            sx={labelTextSx}
          >
            {labelText}
          </Typography>
        </Tooltip>
        {Icon && (
          <Box component={'div'} key={`${labelText}-icon`} id={`${labelText}-icon`} sx={iconAndChildrenSxProps}>
            {Icon}
          </Box>
        )}
      </Box>
      {children && (
        <Box
          component={'div'}
          key={`${labelText}-box-children`}
          id={`${labelText}-box-children`}
          sx={iconAndChildrenSxProps}
        >
          {children}
        </Box>
      )}
    </Box>
  )
);

export default Label;
