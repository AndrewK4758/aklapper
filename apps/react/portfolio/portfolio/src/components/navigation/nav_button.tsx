import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import { useNavigate } from 'react-router';

interface NavButtonProps extends ButtonProps {
  buttonText: string;
  path?: string;
  buttonSx?: SxProps;
}

export default function NavButton({ buttonText, path, buttonSx, ...props }: NavButtonProps) {
  const nav = useNavigate();
  const handleOnClick = () => {
    if (path) nav(path);
  };
  return (
    <Button {...props} data-testid={props.id} sx={buttonSx} onClick={handleOnClick}>
      {buttonText}
    </Button>
  );
}
