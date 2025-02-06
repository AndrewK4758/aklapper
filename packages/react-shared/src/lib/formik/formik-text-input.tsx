import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Variant } from '@mui/material/styles/createTypography.js';
import TextField from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import { FocusEvent } from 'react';
import { Label } from '../label/label.jsx';
import Text from '../text/text.jsx';

export interface FormikTextInputProps<T> {
  name: string;
  formik: FormikProps<T>;
  type: string;
  label: string;
  labelComponent: Variant;
  autoComplete: string;
  id?: string;
  placeholder?: string;
  textSx?: SxProps;
  labelSx?: SxProps;
  onBlurCB?: (event: FocusEvent<unknown>) => void;
  Theme: Theme;
  valueField: keyof T;
}

export function FormikTextInput<T>({
  name,
  formik,
  type,
  label,
  labelComponent,
  autoComplete,
  id,
  placeholder,
  textSx,
  labelSx,
  onBlurCB,
  valueField,
  Theme
}: FormikTextInputProps<T>) {
  if (onBlurCB) formik.handleBlur = onBlurCB;
  const { value } = formik.getFieldProps(valueField as string);

  return (
    <Box key={`${label}-wrapper`} id={`${label}-wrapper`}>
      <Label
        tooltipTitle={label}
        labelVariant={labelComponent}
        labelText={label}
        labelTextsx={labelSx}
        placement={'top'}
      />
      <TextField
        id={id}
        autoComplete={autoComplete}
        multiline={true}
        variant="outlined"
        type={type}
        placeholder={placeholder}
        name={name}
        value={value}
        onChange={e => formik.setFieldValue('text', e.currentTarget.value)}
        slotProps={{
          inputLabel: { sx: textSx }
        }}
        sx={textSx}
        onBlur={formik.handleBlur}
      />
      {formik.getFieldMeta(name).touched && formik.getFieldMeta(name).error ? (
        <Text
          component={'p'}
          id="formik-error-text-input"
          titleVariant="body1"
          titleText={formik.getFieldMeta(name).error}
          sx={{
            ...labelSx,
            color: Theme.palette.error.main,
            fontFamily: 'Roboto',
            fontSize: '1.25rem',
            paddingY: 2,
            [Theme.breakpoints.down('lg')]: {
              fontSize: '0.875rem',
              paddingY: 1
            }
          }}
        />
      ) : null}
    </Box>
  );
}

export default FormikTextInput;
