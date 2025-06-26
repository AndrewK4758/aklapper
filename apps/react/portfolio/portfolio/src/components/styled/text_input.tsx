import { Text } from '@aklapper/react-shared';
import TextField, { type OutlinedTextFieldProps } from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import { useState, type HTMLInputTypeAttribute, type ReactElement } from 'react';
import { BACKGROUND_ALT } from '../../styles/base/base_styles';
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
  const [helperText, setHelperText] = useState<string | null>(null);
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
        slotProps={{
          input: {
            sx: {
              backgroundColor: BACKGROUND_ALT,
              width: '100%',
            },
          },
        }}
      />
      {helperText && <Text variant='caption' children={helperText} />}
    </HelperTextBox>
  );
}
