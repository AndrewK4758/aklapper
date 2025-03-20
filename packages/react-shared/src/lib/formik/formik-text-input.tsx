import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps } from '@mui/material/styles';
import type { Variant } from '@mui/material/styles/createTypography.js';
import type { FormikProps } from 'formik';
import { FocusEvent } from 'react';
import { Label } from '../label/label.jsx';
import FormikValidationError from './formik-validation-error.js';

export interface FormikTextInputProps<T extends object> {
  name: keyof T;
  formik: FormikProps<T>;
  type: string;
  label: string;
  labelComponent: Variant;
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
  tooltipSx
}: FormikTextInputProps<T>) {
  if (onBlurCB) formik.handleBlur = onBlurCB;
  const { value } = formik.getFieldProps(valueField as string);

  return (
    <Box
      key={`${label}-wrapper`}
      id={`${label}-wrapper`}
      display={'flex'}
      flexDirection={'column'}
      gap={1}
      alignItems={'center'}
    >
      <Box width={'100%'}>
        <FormControl variant={'outlined'} fullWidth>
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
            name={name as string}
            value={value}
            onChange={e => formik.setFieldValue(valueField as string, e.currentTarget.value)}
            sx={textSx}
            label={label}
            onBlur={formik.handleBlur}
          />
          <Box component={'section'} id={`${value}-error-box`} display={'flex'} justifyContent={'center'}>
            <FormikValidationError<T> formik={formik} elementName={name} helperTextSx={errorTextSx} />
          </Box>
        </FormControl>
      </Box>
    </Box>
  );
}

export default FormikTextInput;
