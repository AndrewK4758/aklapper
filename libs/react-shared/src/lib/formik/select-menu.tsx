import { AvatarTotem } from '@aklapper/types-game';
import { SxProps } from '@mui/material';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import { useField } from 'formik';
import type { JSX } from 'react';
import Text from '../text/text';
import type { Theme } from '@mui/material/styles';

interface IAvatarColorSelectValues {
  name: string;
  label: string;
  id?: string;
  data: string[] | AvatarTotem[];
  mapCallback(v: unknown, i: number, arr: unknown[]): JSX.Element;
  labelSx?: SxProps;
  selectSx: SxProps;
  Theme: Theme;
}

export function SelectMenu({ label, mapCallback, labelSx, selectSx, data, Theme, ...props }: IAvatarColorSelectValues) {
  const [field, meta] = useField(props);

  return (
    <>
      <InputLabel component={'h2'} variant="filled" sx={labelSx}>
        {label}
      </InputLabel>

      <Select {...field} {...props} autoWidth variant="filled" sx={selectSx}>
        {data.map(mapCallback)}
      </Select>
      {meta.touched && meta.error ? (
        <Text
          component={'p'}
          titleVariant="body1"
          titleText={meta.error}
          sx={{ color: Theme.palette.primary.contrastText, ...labelSx }}
        />
      ) : null}
    </>
  );
}
