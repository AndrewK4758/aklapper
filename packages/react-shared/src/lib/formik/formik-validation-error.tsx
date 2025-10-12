import Box from '@mui/material/Box';
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
  <Box sx={helperTextSx}>
    {formik.touched[elementName] && formik.errors[elementName] ? (
      <FormHelperText error={!!formik.errors[elementName]}>{formik.errors[elementName] as string}</FormHelperText>
    ) : null}
  </Box>
);

export default FormikValidationError;
