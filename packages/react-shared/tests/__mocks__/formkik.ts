import type { FormikProps } from 'formik';
import { vi, type Mock } from 'vitest';

type MockedFormikProps<Values> = Pick<
  FormikProps<Values>,
  'values' | 'handleChange' | 'handleSubmit' | 'errors' | 'touched' | 'setFieldValue' | 'setFieldTouched' | 'handleBlur' // Add other properties as needed
>;

export const createMockFormikProps: Mock<
  (name: string) => MockedFormikProps<{
    name: string;
  }>
> = vi.fn<(name: string) => MockedFormikProps<{ name: string }>>((value: string, error = '', touched = false) => ({
  values: { name: value },
  errors: { name: error },
  touched: { name: touched },
  handleChange: vi.fn(),
  handleBlur: vi.fn(),
  handleSubmit: vi.fn(),
  setFieldValue: vi.fn(),
  setFieldTouched: vi.fn(),
}));
