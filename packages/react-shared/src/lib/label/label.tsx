import Box from '@mui/material/Box';
import InputLabel, { type InputLabelProps } from '@mui/material/InputLabel';
import type { TypographyVariant } from '@mui/material/styles';
import { type SxProps } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { forwardRef, type JSX, type ReactNode } from 'react';

const labelWrapperSxProps: SxProps = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  flex: '0 1 100%',
};

const iconSxProps: SxProps = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center' };

export interface LabelProps extends InputLabelProps {
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
  Icon?: JSX.Element;
  htmlFor: string;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      labelText,
      placement,
      id,
      labelTextSx,
      tooltipSx,
      tooltipTitle,
      Icon,
      htmlFor,
      labelWrapperDivSxProps = labelWrapperSxProps,
      ...props
    },
    ref,
  ) => {
    const hasTooltip = Boolean(tooltipTitle);
    const tooltipId = `${id}-tooltip`;
    const labelId = `${id}`;
    const labelWrapperId = `${id}-wrapper`;
    const iconId = Icon ? `${id}-icon` : undefined;

    const labelContent = (
      <Box component={'div'} id={labelWrapperId} sx={labelWrapperDivSxProps}>
        <InputLabel {...props} ref={ref} component={'label'} is='label' htmlFor={htmlFor} id={labelId} sx={labelTextSx}>
          {labelText}
        </InputLabel>
        {Icon && (
          <Box component={'div'} id={iconId} sx={iconSxProps}>
            {Icon}
          </Box>
        )}
      </Box>
    );

    return (
      <>
        {hasTooltip ? (
          <Tooltip
            id={tooltipId}
            describeChild={true}
            placement={placement}
            title={tooltipTitle}
            slotProps={{ tooltip: { sx: tooltipSx } }}
          >
            {labelContent}
          </Tooltip>
        ) : (
          labelContent
        )}
      </>
    );
  },
);

Label.displayName = 'Label';
export default Label;
