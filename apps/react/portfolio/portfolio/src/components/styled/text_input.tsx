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
  setHelperText: (text: string | null) => void;
}

export default function TextInput<T extends object>({
  name,
  label,
  formik,
  type = 'text',
  multiline = false,
  setHelperText,
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
      onFocus={async () => {
        await formik.setFieldTouched(name, false);
        setHelperText(null);
      }}
      error={formik.touched[name] && !!formik.errors[name]}
      helperText={formik.touched[name] && (formik.errors[name] as string)}
    />
  );
}
