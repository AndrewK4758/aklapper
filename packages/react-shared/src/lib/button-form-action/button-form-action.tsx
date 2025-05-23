import Button from '@mui/material/Button';
import type { SxProps } from '@mui/material/styles';
import type { FormEventHandler } from 'react';
import { Form } from 'react-router';

export interface ButtonFormActionProps {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch' | undefined;
  action: string | undefined;
  handleSubmit?: FormEventHandler;
  variant: 'text' | 'outlined' | 'contained' | undefined;
  name?: string;
  value: string | number | readonly string[] | undefined;
  type: 'button' | 'submit' | 'reset' | undefined;
  sx?: SxProps;
  buttonText: string;
}

export function ButtonFormAction({
  method,
  action,
  handleSubmit,
  variant,
  name,
  value,
  type,
  sx,
  buttonText,
}: ButtonFormActionProps) {
  return (
    <Form method={method} action={action} onSubmit={handleSubmit}>
      <Button variant={variant} name={name} value={value} type={type} sx={sx}>
        {buttonText}
      </Button>
    </Form>
  );
}

export default ButtonFormAction;
