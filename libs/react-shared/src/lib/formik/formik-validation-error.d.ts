import type { SxProps } from '@mui/material/styles';
import type { FormikProps } from 'formik';
interface FormikValidationErrorProps<T> {
    formik: FormikProps<T>;
    elementName: keyof T;
    helperTextSx?: SxProps;
}
export declare const FormikValidationError: <T extends object>({ formik, elementName, helperTextSx }: FormikValidationErrorProps<T>) => import("react/jsx-runtime").JSX.Element;
export default FormikValidationError;
//# sourceMappingURL=formik-validation-error.d.ts.map