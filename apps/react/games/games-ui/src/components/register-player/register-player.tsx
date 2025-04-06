import { FormikValidationError, Label, type httpMethod } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps } from '@mui/material/styles';
import { useFormik, type FormikProps } from 'formik';
import type { ChangeEvent } from 'react';
import { Form, useSubmit, type SubmitFunction } from 'react-router';
import * as Yup from 'yup';
import { errorTextSx, tooltipSx } from '../../styles/games-styles';

function initialValues<T>(defaults: T, key: keyof T, value: unknown): T {
  return {
    ...defaults,
    [key]: value,
  };
}

const validationSchema: Yup.ObjectSchema<Partial<IPlayer>> = Yup.object<Partial<IPlayer>>({
  name: Yup.string().required('Must enter player name').max(30, 'Player name must be less than 31 characters'),
});

interface RegisterPlayerProps<T> {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' | httpMethod;
  inputName: keyof T;
  label: string;
  inputId: string;
  formPropsObject: T;
  inputSx: SxProps;
}

export default function RegisterPlayer<T extends object>({
  formPropsObject,
  inputId,
  label,
  method,
  inputName,
  inputSx,
}: RegisterPlayerProps<T>) {
  const submit = useSubmit();
  const formik = useFormik<T>({
    initialValues: initialValues<T>(formPropsObject, inputName, ''),
    validationSchema: validationSchema,
    onSubmit: async values => handleNewPlayerSubmit(values, submit),
  });

  const { value } = formik.getFieldProps(inputName as string);

  return (
    <Container>
      <Form method={method} onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
        <FormControl>
          <Label
            tooltipTitle={`Enter your player name here. Then submit to enter lobby.`}
            labelVariant={'body2'}
            labelText={label}
            id={`${inputId}-label`}
            placement={'top'}
            htmlFor={inputId}
            tooltipSx={tooltipSx}
          />
          <OutlinedInput
            autoFocus
            id={inputId}
            value={value}
            fullWidth
            name={inputName as string}
            onBlur={formik.handleBlur}
            onChange={async e => await handlePlayerNameChange<T>(e, formik)}
            onFocus={async e => await handleNewPlayerInputTouched(e.currentTarget.name, formik)}
            sx={inputSx}
          />
          <FormikValidationError<T> formik={formik} elementName={inputName} helperTextSx={errorTextSx} />
        </FormControl>
        <br />
        <br />
        <Button type='submit' variant='outlined' id='player-name-button'>
          Enter Player Name
        </Button>
      </Form>
    </Container>
  );
}

async function handleNewPlayerSubmit(values: Partial<IPlayer>, submit: SubmitFunction) {
  try {
    await submit(JSON.stringify(values), { action: 'lobby', encType: 'application/json', method: 'POST' });
  } catch (error) {
    console.error(error);
  }
}

async function handlePlayerNameChange<T>(
  e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  formik: FormikProps<T>,
) {
  await formik.setFieldValue(e.currentTarget.name, e.currentTarget.value);
}

async function handleNewPlayerInputTouched<T>(target: string, formik: FormikProps<T>) {
  await formik.setFieldTouched(target, false);
}
