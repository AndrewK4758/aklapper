import FormHelperText from '@mui/material/FormHelperText';
import type { SxProps } from '@mui/material/styles';
import type { FormikProps } from 'formik';

interface FormikValidationErrorProps<T> {
  formik: FormikProps<T>;
  elementName: Extract<keyof T, string>;
  helperTextSx?: SxProps;
}

export const FormikValidationError = <T extends object>({
  formik,
  elementName,
  helperTextSx,
}: FormikValidationErrorProps<T>) => (
  <>
    {formik.touched[elementName] && formik.errors[elementName] ? (
      <FormHelperText margin='dense' sx={helperTextSx}>
        {formik.errors[elementName] as string}
      </FormHelperText>
    ) : null}
  </>
);

export default FormikValidationError;
