import type { AvatarTotem } from '@aklapper/types';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import type { FormikProps } from 'formik';
import type { JSX } from 'react';
import Label from '../label/label.jsx';

interface IAvatarColorSelectValues<T extends object> {
  name: Extract<keyof T, string>;
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
          error={formik.touched[name] && !!formik.errors[name]}
        >
          {data.map(mapCallback)}
        </Select>
      </FormControl>
    </>
  );
}
