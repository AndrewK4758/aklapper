import { FormikTextInput, Label, type httpMethod } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import axios from 'axios';
import { useFormik } from 'formik';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import { Form, useNavigate, type NavigateFunction } from 'react-router';
import * as Yup from 'yup';
import { ActivePlayerContext, type ActivePlayerContextProps } from '../../context/active-user-context';
import { errorTextSx, tooltipSx } from '../../styles/games-styles';
import { type RegisterPlayerValue } from '../../types/types';

function initialValues<T>(defaults: T, key: keyof T, value: unknown): T {
  return {
    ...defaults,
    [key]: value
  };
}

const validationSchema: Yup.ObjectSchema<RegisterPlayerValue> = Yup.object({
  name: Yup.string().required('Must enter player name').max(30, 'Player name must be less than 31 characters')
});

interface RegisterPlayerProps<T> {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' | httpMethod;
  inputName: keyof T;
  label: string;
  inputId: string;
  formPropsObject: T;
}

export default function RegisterPlayer<T extends object>({
  formPropsObject,
  inputId,
  label,
  method,
  inputName
}: RegisterPlayerProps<T>) {
  const { setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const nav = useNavigate();
  const formik = useFormik<T>({
    initialValues: initialValues<T>(formPropsObject, inputName, ''),
    validationSchema: validationSchema,
    onSubmit: values => handleNewPlayerSubmit(values as RegisterPlayerValue, setActivePlayer, nav)
  });

  return (
    <Container>
      <Form method={method} onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
        <FormikTextInput<T>
          name={inputName}
          formik={formik}
          type={'outlined'}
          label={label}
          labelComponent={'body1'}
          autoComplete={'on'}
          id={inputId}
          errorTextSx={errorTextSx}
          valueField={inputName}
          tooltipTitle={'Enter Player Name Here'}
          tooltipSx={tooltipSx}
          textSx={{}}
          labelSx={{}}
        />
        <Button type="submit" variant="outlined" id="player-name-button">
          <Label
            tooltipTitle={'Enter player name you would like to use in the upcoming games'}
            labelVariant={'button'}
            labelText={'Enter Player Name'}
            id={'player-name-label'}
            placement={'top'}
            htmlFor={'player-name-button'}
            labelTextSx={{ fontSize: '1.5rem' }}
            tooltipSx={tooltipSx}
          />
        </Button>
      </Form>
    </Container>
  );
}

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

async function handleNewPlayerSubmit(
  values: RegisterPlayerValue,
  setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>,
  nav: NavigateFunction
) {
  try {
    const { name } = values;

    const resp = await axios.post(
      `${baseUrl}/register`,
      { name: name },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const newPlayer = resp.data as Partial<IPlayer>;

    setActivePlayer(prev => ({
      ...prev,
      name: newPlayer.name,
      id: newPlayer.id
    }));

    nav('lobby');
  } catch (error) {
    console.error(error);
  }
}
