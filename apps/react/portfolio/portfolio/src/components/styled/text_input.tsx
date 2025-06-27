import { Text } from '@aklapper/react-shared';
import TextField, { type OutlinedTextFieldProps } from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import { useState, type FocusEvent, type HTMLInputTypeAttribute, type ReactElement } from 'react';
import { handleBlur } from '../../utils/utils';
import HelperTextBox from './helper_text_box';

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
  searchParams?: string;
  type?: HTMLInputTypeAttribute;
}

export default function TextInput<T extends object>({
  name,
  label,
  formik,
  type = 'text',
  multiline = false,
  searchParams,
  ...props
}: TextInputProps<T>): ReactElement {
  const [helperText, setHelperText] = useState<string | null>(null);
  if (searchParams)
    formik.handleBlur = (e: FocusEvent<HTMLInputElement>) =>
      //TODO crate param type to help validate correct string for url endpoint
      handleBlur<T>(e, formik, setHelperText, searchParams);

  return (
    <HelperTextBox multiline={multiline}>
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
      {helperText && <Text variant='caption' color='inherit' children={helperText} tabIndex={-1} />}
    </HelperTextBox>
  );
}
