import { GamePlayerValidation } from '@aklapper/types';
import { SxProps } from '@mui/material';
import Button from '@mui/material/Button';
import { useFormik } from 'formik';
import { Form, useNavigate } from 'react-router';
import * as Yup from 'yup';
import { FormActionProps, FormikTextInput } from '@aklapper/react-shared';
import GamesTheme from '../../styles/games-theme';

export interface JoinGameProps extends FormActionProps {
  breakpointsJoinGameButton?: SxProps;
  breakpointsJoinGameText?: SxProps;
  breakpointsJoinGameLabel?: SxProps;
}

type JoinGamePath = { gamePath: string };

const validationSchema = Yup.object({
  gamePath: Yup.string()
    .min(6, 'Must be at least the full game ID')
    .max(60, 'Must be at most the full link to the game')
    .required()
});

export const JoinGame = ({
  breakpointsJoinGameText,
  breakpointsJoinGameButton,
  breakpointsJoinGameLabel,
  method,
  type,
  names,
  variant,
  buttonType,
  buttonText
}: JoinGameProps) => {
  const nav = useNavigate();

  const handleSubmit = (values: JoinGamePath) => {
    const path = values.gamePath;
    const parts = path.split('/');

    const gameID = parts[parts.length - 1];
    const gameName = parts[parts.length - 2];
    const __current_game__ =
      (JSON.parse(sessionStorage.getItem('__current_game__') as string) as GamePlayerValidation) ??
      ({ gameInstanceID: '', playerID: '' } as GamePlayerValidation);

    __current_game__.gameInstanceID = gameID;
    sessionStorage.setItem('__current_game__', JSON.stringify(__current_game__));

    nav(`/games/${gameName}/register`);
  };

  const initialValues: JoinGamePath = { gamePath: '' };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: values => handleSubmit(values)
  });
  return (
    <Form method={method} onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <FormikTextInput<JoinGamePath>
        formik={formik}
        autoComplete="off"
        labelComponent={'h2'}
        label={'Game Path'}
        id="gamePath"
        type={type}
        placeholder="Enter GameID to join"
        name={names[0] as 'gamePath'}
        Theme={GamesTheme}
        textSx={breakpointsJoinGameText}
        labelSx={breakpointsJoinGameLabel}
        valueField={'gamePath'}
      />
      <br />
      <Button type={buttonType} variant={variant} sx={breakpointsJoinGameButton}>
        {buttonText}
      </Button>
    </Form>
  );
};

export default JoinGame;
