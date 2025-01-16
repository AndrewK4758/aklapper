import { SxProps } from '@mui/material';
import { FormEventHandler } from 'react';
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
export declare function ButtonFormAction({ method, action, handleSubmit, variant, name, value, type, sx, buttonText, }: ButtonFormActionProps): import("react/jsx-runtime").JSX.Element;
export default ButtonFormAction;
//# sourceMappingURL=button-form-action.d.ts.map