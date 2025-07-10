import { vi } from 'vitest';

export const createMockFormikProps = vi.fn((value: string, error = '', touched = false) => ({
  values: { name: value },
  errors: { name: error },
  touched: { name: touched },
  handleChange: vi.fn(),
  handleBlur: vi.fn(),
  handleSubmit: vi.fn(),
  setFieldValue: vi.fn(),
  setFieldTouched: vi.fn(),
}));
