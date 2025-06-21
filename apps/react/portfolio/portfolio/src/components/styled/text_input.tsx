import TextField from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import type { HTMLInputTypeAttribute } from 'react';

interface TextInputProps<T extends object> {
  formik: FormikProps<T>;
  name: Extract<keyof T, string>;
  label: string;
  multiline?: boolean;
  type?: HTMLInputTypeAttribute;
  autocomplete?: 'on' | 'off';
}

export default function TextInput<T extends object>({
  autocomplete = 'off',
  name,
  label,
  formik,
  type = 'text',
  multiline = false,
}: TextInputProps<T>) {
  return (
    <TextField
      fullWidth
      autoComplete={autocomplete}
      value={formik.values[name]}
      type={type}
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
