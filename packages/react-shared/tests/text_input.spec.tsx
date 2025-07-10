import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import type { FormikProps } from 'formik';
import TextInput from '../src/lib/text_input/text_input';
import { createMockFormikProps } from './__mocks__/formkik';
import { fireEvent, render, ROUTES, screen } from './utils/render_react_rotuter';

type TextInputFormikTestType = {
  name: string;
};

const NAME = 'name';
const LABEL = 'Name';
const TEST_ID = 'name-input';

let mockFormik: ReturnType<typeof createMockFormikProps>;

describe('test text_input component', () => {
  it('should have attribute name: "name', () => {
    mockFormik = createMockFormikProps(NAME, '', false);

    render(
      <TextInput<TextInputFormikTestType>
        formik={mockFormik as unknown as FormikProps<TextInputFormikTestType>}
        name={NAME}
        label={'Name'}
        variant={'outlined'}
      />,
      { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO },
    );
    const textInput = screen.getByTestId(TEST_ID);

    expect(textInput).toBeInTheDocument();
    expect(screen.getAllByText(LABEL)[0]).toBeInTheDocument();
  });

  it('should handle change', async () => {
    mockFormik = createMockFormikProps(NAME, '', false);

    render(
      <TextInput<TextInputFormikTestType>
        formik={mockFormik as unknown as FormikProps<TextInputFormikTestType>}
        name={NAME}
        label={'Name'}
        variant={'outlined'}
      />,
      { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO },
    );

    const textInput = screen.getByRole('textbox', { name: LABEL });
    const userInput = ': John';

    await userEvent.type(textInput, userInput);

    expect(mockFormik.handleChange).toHaveBeenCalledTimes(userInput.length);
  });

  it('should show error state', async () => {
    const message = 'name error';
    mockFormik = createMockFormikProps(NAME, '', false);
    mockFormik.touched['name'] = true;
    mockFormik.errors['name'] = message;

    render(
      <TextInput<TextInputFormikTestType>
        formik={mockFormik as unknown as FormikProps<TextInputFormikTestType>}
        name={NAME}
        label={'Name'}
        variant={'outlined'}
      />,
      { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO },
    );

    const errorMessage = screen.getByText(message);

    expect(errorMessage).toBeInTheDocument();
  });

  it('should call handleBlur', () => {
    mockFormik = createMockFormikProps(NAME, '', false);

    render(
      <TextInput<TextInputFormikTestType>
        formik={mockFormik as unknown as FormikProps<TextInputFormikTestType>}
        name={NAME}
        label={'Name'}
        variant={'outlined'}
      />,
      { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO },
    );

    const textInput = screen.queryByRole('textbox', { name: LABEL });

    if (textInput) {
      fireEvent.blur(textInput);

      expect(mockFormik.handleBlur).toHaveBeenCalledTimes(1);
    }
  });
});
