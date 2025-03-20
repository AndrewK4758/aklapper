import FormHelperText from '@mui/material/FormHelperText';
import type { SxProps } from '@mui/material/styles';
import type { FormikProps } from 'formik';

interface FormikValidationErrorProps<T> {
  formik: FormikProps<T>;
  elementName: keyof T;
  helperTextSx?: SxProps;
}

export const FormikValidationError = <T extends object>({
  formik,
  elementName,
  helperTextSx
}: FormikValidationErrorProps<T>) => (
  <>
    {formik.touched[elementName] && formik.errors[elementName] ? (
      <pre style={{ margin: 0 }}>
        <FormHelperText sx={helperTextSx}>{formik.errors[elementName] as string}</FormHelperText>
      </pre>
    ) : null}
  </>
);

export default FormikValidationError;
