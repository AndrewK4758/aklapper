import OutlinedTextField, { type OutlinedTextFieldProps } from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import { useState, type FocusEvent, type HTMLInputTypeAttribute, type ReactElement } from 'react';

interface TextInputProps<T extends object> extends OutlinedTextFieldProps {
  formik: FormikProps<T>;
  name: Extract<keyof T, string>;
  label: string;
  multiline?: boolean;
  searchParams?: string;
  type?: HTMLInputTypeAttribute;
  handleBlur?: <T>(
    e: FocusEvent<HTMLInputElement>,
    formik: FormikProps<T>,
    setHelperText: (text: string) => void,
    searchParams: string,
  ) => void;
}

export function TextInput<T extends object>({
  name,
  label,
  formik,
  type = 'text',
  multiline = false,
  searchParams,
  handleBlur,
  ...props
}: TextInputProps<T>): ReactElement {
  const [helperText, setHelperText] = useState<string | null>(null);
  if (searchParams && handleBlur)
    formik.handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      handleBlur<T>(e, formik, setHelperText, searchParams);
    };
  return (
    <OutlinedTextField
      {...props}
      fullWidth
      value={formik.values[name]}
      type={type}
      data-testid={`${name}-input`}
      name={name}
      disabled={formik.isSubmitting}
      label={label}
      multiline={multiline}
      rows={multiline ? 4 : 1}
      onBlur={formik.handleBlur}
      onChange={formik.handleChange}
      onFocus={async () => handleFocus<T>(formik, name, setHelperText)}
      error={formik.touched[name] && !!formik.errors[name]}
      helperText={
        (formik.touched[name] && (formik.errors[name] as string)) ||
        (formik.touched[name] && !formik.errors[name] && helperText)
      }
      sx={{ height: multiline ? '158px' : '81px' }}
    />
  );
}

async function handleFocus<T>(formik: FormikProps<T>, name: string, setHelperText: (helperText: null) => void) {
  await formik.setFieldTouched(name, false);
  setHelperText(null);
}

export default TextInput;
