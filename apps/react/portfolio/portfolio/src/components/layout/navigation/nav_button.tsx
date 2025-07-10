import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import type { MouseEvent } from 'react';
import { useNavigate, useNavigation } from 'react-router';

interface NavButtonProps extends ButtonProps {
  buttonText: string;
  name: string;
  params?: string;
  buttonSx?: SxProps;
}

export default function NavButton({ buttonText, name, buttonSx, params, ...props }: NavButtonProps) {
  const { state } = useNavigation();
  const nav = useNavigate();
  const handleOnClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (params) nav(`${e.currentTarget.name}${params}`);
    else nav(e.currentTarget.name);
  };

  return (
    <Button {...props} disabled={state !== 'idle'} name={name} sx={buttonSx} role='button' onClick={handleOnClick}>
      {buttonText}
    </Button>
  );
}
