import TextField, { type OutlinedTextFieldProps } from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import type { HTMLInputTypeAttribute, ReactElement } from 'react';

interface TextInputProps<T extends object>
  extends Omit<
    OutlinedTextFieldProps,
    | 'name'
    | 'label'
    | 'type'
    | 'fullWidth'
    | 'value'
    | 'type'
    | 'data-testid'
    | 'rows'
    | 'onBlur'
    | 'onChange'
    | 'onFocus'
    | 'error'
    | 'helperText'
  > {
  formik: FormikProps<T>;
  name: Extract<keyof T, string>;
  label: string;
  multiline?: boolean;
  type?: HTMLInputTypeAttribute;
}

export default function TextInput<T extends object>({
  name,
  label,
  formik,
  type = 'text',
  multiline = false,
  ...props
}: TextInputProps<T>): ReactElement {
  return (
    <TextField
      {...props}
      fullWidth
      value={formik.values[name]}
      type={type}
      data-testid={name}
      name={name}
      label={label}
      variant='outlined'
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
