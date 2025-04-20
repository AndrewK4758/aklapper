import { FormikValidationError, Label, type httpMethod } from '@aklapper/react-shared';
import type { IPlayerClientData } from '@aklapper/types';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container, { type ContainerProps } from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps } from '@mui/material/styles';
import axios from 'axios';
import { useFormik, type FormikProps } from 'formik';
import {
  useContext,
  useEffect,
  useRef,
  type ChangeEvent,
  type Dispatch,
  type FocusEvent,
  type SetStateAction,
} from 'react';
import { Form, useNavigate, type NavigateFunction } from 'react-router';
import * as Yup from 'yup';
import ActivePlayerContext, { type ActivePlayerContextProps } from '../../context/active-player-context';
import { errorTextSx, tooltipSx } from '../../styles/games-styles';

const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const initialValues: Partial<Partial<IPlayerClientData>> = {
  name: '',
  email: '',
};

const validationSchema: Yup.ObjectSchema<Partial<Partial<IPlayerClientData>>> = Yup.object<
  Partial<Partial<IPlayerClientData>>
>({
  name: Yup.string().required('Must enter player name').max(30, 'Player name must be less than 31 characters'),
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

export default function RegisterPlayer({ method, index, tab, inputSx, ContainerProps }: RegisterPlayerProps) {
  const { setActivePlayer } = useContext<ActivePlayerContextProps>(ActivePlayerContext);
  const nav = useNavigate();

  const ref = useRef<HTMLInputElement>(null);

  const formik: FormikProps<Partial<Partial<IPlayerClientData>>> = useFormik<Partial<Partial<IPlayerClientData>>>({
    initialValues: initialValues,
    validationSchema: validationSchema,
    validateOnChange: false,
    onSubmit: async values => handleNewPlayerSubmit(values, setActivePlayer, nav),
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
            htmlFor={'register-email'}
            tooltipSx={tooltipSx}
          />
          <OutlinedInput
            inputRef={ref}
            id={'register-email'}
            value={formik.values.email}
            fullWidth
            label={'Email'}
            name={'email'}
            onBlur={e => handleCheckEmailOnBlur(e, formik)}
            onChange={async e => await handlePlayerNameChange(e, formik)}
            onFocus={async e => await handleNewPlayerInputTouched(e, formik)}
            sx={inputSx}
          />
          <FormikValidationError<Partial<IPlayerClientData>>
            formik={formik}
            elementName={'email'}
            helperTextSx={errorTextSx(formik.errors.email as string)}
          />
        </FormControl>
        <FormControl>
          <Label
            tooltipTitle={`Enter your player name here. Then submit to enter lobby.`}
            labelVariant={'body2'}
            labelText={'Player Name'}
            id={`player-name-label`}
            placement={'top'}
            htmlFor={'register-name'}
            tooltipSx={tooltipSx}
          />
          <OutlinedInput
            id={'register-name'}
            value={formik.values.name}
            fullWidth
            label={'Player Name'}
            name={'name'}
            onBlur={formik.handleBlur}
            onChange={async e => await handlePlayerNameChange(e, formik)}
            onFocus={async e => await handleNewPlayerInputTouched(e, formik)}
            sx={inputSx}
          />
          <FormikValidationError<Partial<IPlayerClientData>>
            formik={formik}
            elementName={'name'}
            helperTextSx={errorTextSx(formik.errors.name as string)}
          />
        </FormControl>
        <ButtonGroup sx={{ justifyContent: 'space-between' }}>
          <Button type='submit' variant='outlined' id='register-player-button' fullWidth>
            Register
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
  values: Partial<IPlayerClientData>,
  setActivePlayer: Dispatch<SetStateAction<IPlayerClientData>>,
  nav: NavigateFunction,
): Promise<void> {
  try {
    const { name, email } = values as IPlayerClientData;

    const resp = await axios.post(
      `${baseUrl}/register`,
      { name: name, email: email },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const { id, activeGameID, inLobby, currentTimeEntered, socketIoId } = resp.data as IPlayerClientData;

    const currentPlayer: IPlayerClientData = {
      name: name,
      id: id,
      activeGameID: activeGameID,
      inLobby: inLobby,
      currentTimeEntered: currentTimeEntered,
      socketIoId: socketIoId,
      email: email,
    };

    localStorage.setItem('activePlayer', JSON.stringify(currentPlayer));

    setActivePlayer(currentPlayer);

    nav('lobby');
  } catch (error) {
    console.error(error);
  }
}

async function handlePlayerNameChange(
  e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  formik: FormikProps<Partial<IPlayerClientData>>,
) {
  await formik.setFieldValue(e.currentTarget.name, e.currentTarget.value);
}

async function handleNewPlayerInputTouched(
  e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  formik: FormikProps<Partial<IPlayerClientData>>,
) {
  await formik.setFieldTouched(e.currentTarget.name, false);
}

async function handleCheckEmailOnBlur(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  formik: FormikProps<Partial<IPlayerClientData>>,
) {
  if ((formik.values.email as string).length && emailRegex.test(formik.values.email as string)) {
    const { setTouched, setError } = formik.getFieldHelpers('email');
    try {
      const resp = await axios.get(`${baseUrl}/player-exists?email=${formik.values.email}`);

      const { exists } = resp.data;

      if (exists === true) {
        await setTouched(true);
        setError('Email exists, please login to continue');
      }
      if (exists === false) {
        await setTouched(true);
        setError('Email available! Please register to continue');
      }
    } catch (error) {
      console.error(error);
      await setTouched(true);
      setError('Error validating email. Please re-enter email and change cursor focus away from email input');
    }
  } else formik.handleBlur(event);
}
