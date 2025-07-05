import { vi } from 'vitest';

export const mockUseFormik = vi.fn();

vi.mock('formik', async () => {
  const actual = await import('formik');

  return {
    ...actual,
    useFormik: () => mockUseFormik,
  };
});
