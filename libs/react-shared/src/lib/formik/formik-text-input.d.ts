import type { SxProps, Theme } from '@mui/material/styles';
import { ElementType, FocusEvent } from 'react';
export interface FormikTextInputProps {
    name: string;
    type: string;
    label: string;
    labelComponent: ElementType;
    size?: string;
    autoComplete: string;
    id?: string;
    placeholder?: string;
    textSx?: SxProps;
    labelSx?: SxProps;
    onBlurCB?: (event: FocusEvent<unknown>) => void;
    Theme: Theme;
}
export declare function FormikTextInput({ label, textSx, labelSx, autoComplete, labelComponent, size, onBlurCB, Theme, ...props }: FormikTextInputProps): import("react/jsx-runtime").JSX.Element;
export default FormikTextInput;
//# sourceMappingURL=formik-text-input.d.ts.map