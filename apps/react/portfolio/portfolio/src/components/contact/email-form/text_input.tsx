import TextField from '@mui/material/TextField';
import type { FormikProps } from 'formik';

interface TextInputProps<T extends object> {
  formik: FormikProps<T>;
  name: Extract<keyof T, string>;
  label: string;
  multiline?: boolean;
}

export default function TextInput<T extends object>({ name, label, formik, multiline = false }: TextInputProps<T>) {
  return (
    <TextField
      fullWidth
      autoComplete='on'
      value={formik.values[name]}
      type='text'
      data-testid={name}
      name={name}
      label={label}
      multiline={multiline}
      rows={multiline ? 4 : 1}
      onBlur={formik.handleBlur}
      onChange={formik.handleChange}
      onFocus={() => formik.setFieldTouched(name, false)}
      error={formik.touched[name] && !!formik.errors[name]}
      helperText={formik.touched[name] && (formik.errors[name] as string)}
    />
  );
}
