import type { ButtonProps } from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import BaseStyledButton from '../styled/base_button.js';

interface NavButtonProps extends ButtonProps {
  buttonText: string;
  path: string;
  tooltipTitle: string | ReactNode;
  buttonSx?: SxProps;
  tooltipSx?: SxProps;
  placement?: TooltipProps['placement'];
}

export default function NavButton({
  buttonText,
  path,
  tooltipTitle,
  placement = 'bottom',
  buttonSx,
  tooltipSx,
  ...props
}: NavButtonProps) {
  const nav = useNavigate();
  const handleOnClick = () => {
    nav(path);
  };
  return (
    <Tooltip title={tooltipTitle} placement={placement} sx={tooltipSx}>
      <BaseStyledButton {...props} data-testid={props.id} sx={buttonSx} onClick={handleOnClick}>
        {buttonText}
      </BaseStyledButton>
    </Tooltip>
  );
}
