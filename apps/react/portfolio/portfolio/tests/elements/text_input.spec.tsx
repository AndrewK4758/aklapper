import '@testing-library/jest-dom';
import { useFormik, type FormikConfig } from 'formik';
import { Form } from 'react-router';
import TextInput from '../../src/components/text_input/text_input';
import { ROUTES, render, screen } from '../utils/render_react_rotuter';

type TestForm = { name: string };
type FormikTest = FormikConfig<TestForm>;

const NAME = 'TEST';
const LABEL = 'Name';
const initVals: TestForm = { name: NAME };

const initConfig: FormikTest = {
  initialValues: initVals,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onSubmit: () => {},
};
const renderForm = function (formikOptions: FormikTest) {
  const MockForm = () => {
    const formik = useFormik<TestForm>(formikOptions);

    return (
      <Form>
        <TextInput<TestForm> formik={formik} name={'name'} label={LABEL} variant={'outlined'} />
      </Form>
    );
  };
  render(<MockForm />, { initialRoute: ROUTES.PORTFOLIO, path: ROUTES.PORTFOLIO });
};

describe('test text input states and events', () => {
  it('should render in normal state with provided initial value', () => {
    const formikOptions: FormikTest = {
      initialValues: initVals,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onSubmit: () => {},
    };

    renderForm(formikOptions);

    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toHaveValue(NAME);
  });

  it('should render in errored state', () => {
    const formikOptions: FormikTest = {
      ...initConfig,
      initialErrors: { name: 'Error State' },
      initialTouched: { name: true },
    };
    renderForm(formikOptions);

    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toHaveValue(NAME);

    const errorText = screen.getByText('Error State');
    expect(errorText).toBeInTheDocument();
  });
});
