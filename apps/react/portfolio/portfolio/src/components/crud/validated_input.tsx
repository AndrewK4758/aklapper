import { Text } from '@aklapper/react-shared';
import type { FormikProps } from 'formik/dist/types';
import HelperTextBox from '../styled/helper_text_box';
import TextInput from '../styled/text_input';

interface ValidatedInputProps<T extends object> {
  formik: FormikProps<T>;
  name: Extract<keyof T, string>;
  label: string;
  helperText: string | null;
  setHelperText: (textValue: string | null) => void;
}

export default function ValidatedInput<T extends object>({
  formik,
  helperText,
  label,
  name,
  setHelperText,
}: ValidatedInputProps<T>) {
  return (
    <HelperTextBox>
      <TextInput<T> label={label} formik={formik} name={name} setHelperText={setHelperText} variant='outlined' />
      {helperText && <Text variant='caption' children={helperText} />}
    </HelperTextBox>
  );
}
