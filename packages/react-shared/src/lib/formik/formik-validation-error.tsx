import type { SxProp } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import FormHelperText from '@mui/material/FormHelperText';
import type { FormikProps } from 'formik';

interface FormikValidationErrorProps<T> {
  formik: FormikProps<T>;
  elementName: Extract<keyof T, string>;
  helperTextSx?: SxProp;
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
