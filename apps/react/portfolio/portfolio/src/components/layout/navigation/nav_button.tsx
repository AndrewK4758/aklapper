import type { ButtonProps } from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import BaseStyledButton from '../styled/base_button.js';

interface NavButtonProps extends ButtonProps {
  buttonText: string;
  tooltipTitle: string;
  buttonSx?: SxProps;
  tooltipSx?: SxProps;
}

export default function NavButton({ buttonText, tooltipTitle, buttonSx, tooltipSx, ...props }: NavButtonProps) {
  return (
    <Tooltip title={tooltipTitle} sx={tooltipSx}>
      <BaseStyledButton {...props} data-testid={props.id} sx={buttonSx}>
        {buttonText}
      </BaseStyledButton>
    </Tooltip>
  );
}
