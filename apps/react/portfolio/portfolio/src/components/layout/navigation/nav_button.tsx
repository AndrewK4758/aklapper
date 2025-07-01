import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router';

interface NavButtonProps extends ButtonProps {
  buttonText: string;
  name: string;
  buttonSx?: SxProps;
}

export default function NavButton({ buttonText, name, buttonSx, ...props }: NavButtonProps) {
  const nav = useNavigate();
  const handleOnClick = (e: MouseEvent<HTMLButtonElement>) => {
    nav(e.currentTarget.name);
  };
  return (
    <Button {...props} data-testid={props.id} sx={buttonSx} onClick={handleOnClick}>
      {buttonText}
    </Button>
  );
}
