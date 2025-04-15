import type { AvatarTotem } from '@aklapper/types';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import type { FormikProps } from 'formik';
import type { JSX } from 'react';
import Label from '../label/label.jsx';
import FormikValidationError from './formik-validation-error.js';

interface IAvatarColorSelectValues<T extends object> {
  name: keyof T;
  label: string;
  data: string[] | AvatarTotem[];
  mapCallback(v: unknown, i: number, arr: unknown[]): JSX.Element;
  labelSx?: SxProps;
  selectSx: SxProps;
  formik: FormikProps<T>;
  tooltipTitle: string;
  labelVariant: TypographyVariant;
  labelWrapperSx: SxProps;
  tooltipSx: SxProps;
  id: string;
  errorTextSx: SxProps;
  selectSlotProps: SxProps;
}

export function SelectMenu<T extends object>({
  label,
  mapCallback,
  labelSx,
  selectSx,
  data,
  formik,
  name,
  tooltipTitle,
  labelVariant,
  labelWrapperSx,
  tooltipSx,
  id,
  errorTextSx,
  selectSlotProps,
}: IAvatarColorSelectValues<T>) {
  return (
    <>
      <FormControl id={`${id}-form-control`}>
        <Label
          tooltipTitle={tooltipTitle}
          labelVariant={labelVariant}
          id={id}
          labelText={label}
          placement={'right'}
          htmlFor={id}
          tooltipSx={tooltipSx}
          labelWrapperDivSxProps={labelWrapperSx}
          labelTextSx={labelSx}
        />

        <Select
          label={label}
          name={name as string}
          autoWidth
          variant='outlined'
          sx={selectSx}
          onChange={async e => await formik.setFieldValue(name as string, e.target.value)}
          value={formik.values[name]}
          slotProps={{ input: { id: id, sx: selectSlotProps } }}
        >
          {data.map(mapCallback)}
        </Select>
      </FormControl>
      <FormikValidationError<T> formik={formik} elementName={name} helperTextSx={errorTextSx} />
    </>
  );
}
