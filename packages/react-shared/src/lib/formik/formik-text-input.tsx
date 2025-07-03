import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';
import { Label } from '../label/label.jsx';

export interface FormikTextInputProps<T extends object> {
  name: Extract<keyof T, string>;
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
  textSx,
  labelSx,
  onBlurCB,
  valueField,
  labelWrapperSx,
  tooltipTitle,
  tooltipSx,
}: FormikTextInputProps<T>) {
  if (onBlurCB) formik.handleBlur = onBlurCB;
  const { value } = formik.getFieldProps(valueField as string);

  return (
    <FormControl sx={{ width: '100%' }}>
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
        label={label}
        name={name as string}
        value={value}
        onChange={async e => await formik.setFieldValue(valueField as string, e.currentTarget.value)}
        sx={textSx}
        onBlur={formik.handleBlur}
        error={formik.touched[name] && !!formik.errors[name]}
      />
    </FormControl>
  );
}

export default FormikTextInput;
