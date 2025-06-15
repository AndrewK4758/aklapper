import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import type { ButtonProps } from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import MenuButton from '../styled/contact_dialgo_button.js';

interface NavButtonProps extends Omit<ButtonProps, 'onClick'> {
  buttonText: string;
  testId?: string;
  tooltipTitle: string;
  sx?: SxProps;
  onHandleNavButtonClick: () => void;
}

export default function NavButton({
  buttonText,
  testId,
  tooltipTitle,
  sx,
  disabled,
  onHandleNavButtonClick,
  ...props
}: NavButtonProps) {
  const button = (
    <MenuButton
      {...props}
      disabled={disabled}
      data-testid={testId ?? props.id}
      onClick={onHandleNavButtonClick}
      sx={sx}
    >
      <Text variant={'button'} component={'span'}>
        {buttonText}
      </Text>
    </MenuButton>
  );

  return (
    <Tooltip title={tooltipTitle}>
      <Box component={'span'} display={'inline-block'}>
        {button}
      </Box>
    </Tooltip>
  );
}
