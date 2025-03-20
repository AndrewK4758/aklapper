import { FormActionProps, FormikTextInput } from '@aklapper/react-shared';
import { GamePlayerValidation } from '@aklapper/types';
import { SxProps } from '@mui/material';
import Button from '@mui/material/Button';
import { useFormik } from 'formik';
import { Form, useNavigate } from 'react-router';
import * as Yup from 'yup';

export interface JoinGameProps extends FormActionProps {
  homePageJoinGameButton?: SxProps;
  homePageJoinGameLabel?: SxProps;
  homePageJoinGameTextfield?: SxProps;
  textfieldLabelWrapper?: SxProps;
  tooltipSx: SxProps;
  errorTextSx: SxProps;
}

type JoinGamePath = { gamePath: string };

const validationSchema: Yup.ObjectSchema<JoinGamePath> = Yup.object({
  gamePath: Yup.string()
    .test('Validate path string', "Incorrect format.\nGame Path must begin with '/'", (value: string | undefined) => {
      if (typeof value === 'string') return value.startsWith('/');
      else return false;
    })
    .min(
      17,
      "Must be the full path to locate game.\nStructure: /games <- Path for games, /{game name} <- name of game, /{game id} <- unique id to the selected game.\nExmaple '/games/Chutes-&-Ladders/abc123'"
    )
    .max(60, 'Cannot be more than the path with game id')
    .required()
});

export const JoinGame = ({
  homePageJoinGameButton,
  homePageJoinGameLabel,
  homePageJoinGameTextfield,
  textfieldLabelWrapper,
  errorTextSx,
  method,
  type,
  names,
  variant,
  buttonType,
  buttonText,
  tooltipSx
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
        labelComponent={'body2'}
        label={'Game Path'}
        id="gamePath"
        type={type}
        name={names[0] as 'gamePath'}
        errorTextSx={errorTextSx}
        labelSx={homePageJoinGameLabel}
        labelWrapperSx={textfieldLabelWrapper}
        valueField={'gamePath'}
        textSx={homePageJoinGameTextfield}
        tooltipTitle={'This is where you enter the game path to join the game instance.'}
        tooltipSx={tooltipSx}
      />
      <br />
      <Button type={buttonType} variant={variant} sx={homePageJoinGameButton}>
        {buttonText}
      </Button>
    </Form>
  );
};

export default JoinGame;
