import { FormikValidationError, Label, type httpMethod } from '@aklapper/react-shared';
import type { IPlayer } from '@aklapper/types';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container, { type ContainerProps } from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps } from '@mui/material/styles';
import axios from 'axios';
import { useFormik, type FormikProps } from 'formik';
import { useContext, useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Form, useNavigate, type NavigateFunction } from 'react-router';
import * as Yup from 'yup';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { errorTextSx, tooltipSx } from '../../styles/games-styles';

const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const initialValues: Partial<IPlayer> = {
  email: '',
};

const validationSchema: Yup.ObjectSchema<Partial<IPlayer>> = Yup.object<Partial<IPlayer>>({
  email: Yup.string()
    .required('Must enter valid email address')
    .test({
      name: 'regexTest',
      message: 'Must enter valid email address in the form LOCAL@DOMAIN.TLD',
      test: email => emailRegex.test(email),
    })
    .email(),
});

interface RegisterPlayerProps {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' | httpMethod;
  index: number;
  tab: number;
  inputSx: SxProps;
  ContainerProps?: ContainerProps;
}

export default function LoginPlayer({ method, index, tab, inputSx, ContainerProps }: RegisterPlayerProps) {
  const { setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const nav = useNavigate();

  const ref = useRef<HTMLInputElement>(null);

  const formik: FormikProps<Partial<IPlayer>> = useFormik<Partial<IPlayer>>({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async values => handleNewPlayerSubmit(values, setActivePlayer, nav, formik),
  });

  useEffect(() => {
    if (ref.current) ref.current.focus();
  }, [tab]);

  return (
    <Container
      {...ContainerProps}
      role='tabpanel'
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      hidden={tab !== index}
    >
      <Form
        method={method}
        onSubmit={formik.handleSubmit}
        onReset={formik.handleReset}
        style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}
      >
        <FormControl>
          <Label
            tooltipTitle={'Enter email here. This will be used for future logins and resuming games'}
            labelVariant={'body2'}
            labelText={'Email'}
            id={'email-label'}
            placement={'top'}
            htmlFor={'login-email'}
            tooltipSx={tooltipSx}
          />
          <OutlinedInput
            inputRef={ref}
            id={'login-email'}
            value={formik.values.email}
            fullWidth
            label={'Email'}
            name={'email'}
            onBlur={formik.handleBlur}
            onChange={async e => await handlePlayerNameChange(e, formik)}
            onFocus={async e => await handleNewPlayerInputTouched(e, formik)}
            sx={inputSx}
          />
          <FormikValidationError<Partial<IPlayer>>
            formik={formik}
            elementName={'email'}
            helperTextSx={errorTextSx(formik.errors.email as string)}
          />
        </FormControl>

        <ButtonGroup sx={{ justifyContent: 'space-between' }}>
          <Button type='submit' variant='outlined' id='register-player-button' fullWidth>
            Login
          </Button>
          <Button type='reset' variant='outlined' id='clear-register-player-button' fullWidth>
            Clear
          </Button>
        </ButtonGroup>
      </Form>
    </Container>
  );
}

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

async function handleNewPlayerSubmit(
  values: Partial<IPlayer>,
  setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>,
  nav: NavigateFunction,
  formik: FormikProps<Partial<IPlayer>>,
): Promise<void> {
  try {
    const { email } = values as Partial<IPlayer>;

    const resp = await axios.post(
      `${baseUrl}/login`,
      { login: email },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const { name, id, activeGameID, inLobby } = resp.data as Partial<IPlayer>;

    const currentPlayer = { name: name, id: id, ActiveGameID: activeGameID, inLobby: inLobby };

    localStorage.setItem('activePlayer', JSON.stringify(currentPlayer));

    setActivePlayer(currentPlayer);

    nav('lobby');
  } catch (error) {
    console.error(error);

    await formik.setFieldTouched('email', true);
    formik.setFieldError('email', 'Email not registered. Please register player to continue');
  }
}

async function handlePlayerNameChange(
  e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  formik: FormikProps<Partial<IPlayer>>,
) {
  await formik.setFieldValue(e.currentTarget.name, e.currentTarget.value);
}

async function handleNewPlayerInputTouched(
  e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  formik: FormikProps<Partial<IPlayer>>,
) {
  await formik.setFieldTouched(e.currentTarget.name, false);
}
