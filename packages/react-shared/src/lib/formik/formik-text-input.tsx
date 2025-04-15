import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';
import { Label } from '../label/label.jsx';
import FormikValidationError from './formik-validation-error.js';

export interface FormikTextInputProps<T extends object> {
  name: keyof T;
  formik: FormikProps<T>;
  type: string;
  label: string;
  labelComponent: TypographyVariant;
  autoComplete: string;
  id: string;
  placeholder?: string;
  textSx?: SxProps;
  labelSx?: SxProps;
  onBlurCB?: (event: FocusEvent<unknown>) => void;
  errorTextSx: SxProps;
  valueField: keyof T;
  labelWrapperSx?: SxProps;
  tooltipTitle: string;
  tooltipSx: SxProps;
}

export function FormikTextInput<T extends object>({
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
  errorTextSx,
  labelWrapperSx,
  tooltipTitle,
  tooltipSx,
}: FormikTextInputProps<T>) {
  if (onBlurCB) formik.handleBlur = onBlurCB;
  const { value } = formik.getFieldProps(valueField as string);

  return (
    <FormControl>
      <Label
        id={id}
        htmlFor={id}
        tooltipTitle={tooltipTitle}
        labelVariant={labelComponent}
        labelText={label}
        labelTextSx={labelSx}
        labelWrapperDivSxProps={labelWrapperSx}
        placement={'top'}
        tooltipSx={tooltipSx}
      />

      <OutlinedInput
        id={id}
        autoComplete={autoComplete}
        type={type}
        placeholder={placeholder}
        label={label}
        name={name as string}
        value={value}
        onChange={async e => await formik.setFieldValue(valueField as string, e.currentTarget.value)}
        sx={textSx}
        onBlur={formik.handleBlur}
      />

      <Box component={'section'} id={`${value}-error-box`} display={'flex'} justifyContent={'center'}>
        <FormikValidationError<T> formik={formik} elementName={name} helperTextSx={errorTextSx} />
      </Box>
    </FormControl>
  );
}

export default FormikTextInput;
