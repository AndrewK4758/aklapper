import type { SxProps } from '@mui/material/styles';
import type { FormMethod } from 'react-router';

export type httpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface FormActionProps {
  method: FormMethod | httpMethod;
  action?: string;
  handleSubmit?: () => unknown;
  names: string[];
  value?: string | number | readonly string[] | undefined;
  type: 'text' | 'file';
  variant: 'outlined' | 'text' | 'contained';
  sx?: SxProps;
  buttonText: string;
  buttonType: 'button' | 'submit' | undefined;
}
