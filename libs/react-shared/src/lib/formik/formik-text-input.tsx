import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import { useField } from 'formik';
import { ElementType, FocusEvent } from 'react';
import { Label } from '../label/label';
import Text from '../text/text';

export interface FormikTextInputProps {
  name: string;
  type: string;
  label: string;
  labelComponent: ElementType;
  size?: string;
  autoComplete: string;
  id?: string;
  placeholder?: string;
  textSx?: SxProps;
  labelSx?: SxProps;
  onBlurCB?: (event: FocusEvent<unknown>) => void;
  Theme: Theme;
}

export function FormikTextInput({
  label,
  textSx,
  labelSx,
  autoComplete,
  labelComponent,
  size,
  onBlurCB,
  Theme,
  ...props
}: FormikTextInputProps) {
  const [field, meta] = useField(props);
  if (onBlurCB) field.onBlur = onBlurCB;

  return (
    <Box key={`${label}-wrapper`} id={`${label}-wrapper`}>
      <Label tooltipTitle={label} labelVariant={'h2'} labelText={label} sx={labelSx} placement={'top'} />
      <TextField
        id="chat-text-input-id"
        autoComplete={autoComplete}
        multiline={true}
        variant="outlined"
        {...props}
        {...field}
        name={field.name}
        value={field.value}
        slotProps={{
          inputLabel: { sx: textSx }
        }}
        sx={textSx}
        onBlur={field.onBlur}
      />
      {meta.touched && meta.error ? (
        <Text
          component={'p'}
          id="formik-error-text-input"
          titleVariant="body1"
          titleText={meta.error}
          sx={{ ...labelSx, color: Theme.palette.error.main, fontFamily: 'Roboto', fontSize: '1.25rem', paddingY: 2 }}
        />
      ) : null}
    </Box>
  );
}

export default FormikTextInput;
