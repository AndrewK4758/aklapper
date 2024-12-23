import { FormikTextInput, SelectMenu } from '@aklapper/react-shared';
import { IRegisterUserClient } from '@aklapper/types-api';
import { AvatarTotem, Color, ILoadRegisterData } from '@aklapper/types-game';
import { SxProps } from '@mui/material';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import { Form, Formik } from 'formik';
import { CSSProperties } from 'react';
import { useParams, useRouteLoaderData, useSubmit } from 'react-router-dom';
import * as Yup from 'yup';
import { GamesTheme as Theme } from '../../styles/games-theme';

//AFTER API WORK ON AUTO SELECTING THE PLAYER NAME TO BE THE NAME OF THE REGISTERED USER

const breakpointsSelectMenuSxProps: SxProps = {
  color: Theme.palette.primary.main,
  backgroundColor: Theme.palette.info.main,
  display: 'flex',
  justifyContent: 'space-between',
  [Theme.breakpoints.down('md')]: {
    fontSize: '17px'
  }
};

const breakpointsRegisterPlayerButton: SxProps = {
  flex: '1 0 15%',
  alignSelf: 'end',
  justifySelf: 'center',
  backgroundColor: Theme.palette.info.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '17px',
    width: 130,
    height: 35
  }
};

const breakpointsRegisterPlayerLabel: SxProps = {
  m: 1,
  [Theme.breakpoints.down('md')]: {
    fontSize: '17px'
  }
};

const breakpointsRegisterPlayerTextInput: SxProps = {
  width: '35vw',
  backgroundColor: Theme.palette.info.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '20px',
    height: 45,
    width: 200
  }
};

const breakpointsRegisterPlayerSelectInput: SxProps = {
  width: '25%',
  textAlign: 'center',
  backgroundColor: Theme.palette.info.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '19px',
    height: 45,
    width: 200
  }
};

const breakpointsFormContianer: SxProps = {
  textAlign: 'start',
  flexDirection: 'column',
  paddingX: '1rem',
  [Theme.breakpoints.down('md')]: {
    alignContent: 'center'
  }
};

const breakpointsAvatarPicture: CSSProperties = {
  width: '64px',
  height: '64px'
};

const initialValues = {
  playerName: '',
  avatarName: '',
  avatarColor: ''
};

const avatarColorMap = (e: Color, _i: number, _arr: string[]) => (
  <MenuItem key={e} value={e} divider={true} sx={breakpointsSelectMenuSxProps}>
    {e}
  </MenuItem>
);

const avatarListMap = (e: AvatarTotem, _i: number, _arr: AvatarTotem[]) => (
  <MenuItem key={e.name} value={e.name} divider={true} sx={breakpointsSelectMenuSxProps}>
    {e.name}
    <img src={`./game-avatars/${e.image}`} alt={`${e.name} avatar`} style={breakpointsAvatarPicture} />
  </MenuItem>
);

export default function RegisterPlayerAndAvatarForm() {
  const params = useParams();
  const submit = useSubmit();
  const data = useRouteLoaderData('registerData') as ILoadRegisterData;

  const user = JSON.parse(sessionStorage.getItem('user') as string) as IRegisterUserClient;

  const validationSchema = Yup.object().shape({
    playerName: Yup.string()
      .min(2, 'Must be min of 2 characters')
      .max(20, 'Must be 20 characters or less')
      .required('Required, please enter player name')
      .default(user.playerName),
    avatarName: Yup.string().required('Required, please select avatar name'),
    avatarColor: Yup.string().required('Required, please select avatar color')
  });

  const colors = Object.values(data.avatarColorList) as Color[];
  const avatars = data.avatarList as AvatarTotem[];

  const id = params.id;

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={values => submit(values, { method: 'patch', action: `/games/${id}/play`, encType: 'application/json' })}
    >
      <Form>
        <Container component={'section'} sx={breakpointsFormContianer}>
          {user.playerName ? null : (
            <FormikTextInput
              autoComplete="off"
              labelComponent={'h2'}
              type="text"
              name="playerName"
              label="Player Name"
              textSx={breakpointsRegisterPlayerTextInput}
              labelSx={breakpointsRegisterPlayerLabel}
              Theme={Theme}
            />
          )}
          <SelectMenu
            name="avatarName"
            label="Avatar Name"
            data={avatars}
            mapCallback={avatarListMap}
            labelSx={breakpointsRegisterPlayerLabel}
            selectSx={breakpointsRegisterPlayerSelectInput}
            Theme={Theme}
          />
          <SelectMenu
            name="avatarColor"
            label="Avatar Color"
            data={colors}
            mapCallback={avatarColorMap}
            labelSx={breakpointsRegisterPlayerLabel}
            selectSx={breakpointsRegisterPlayerSelectInput}
            Theme={Theme}
          />
        </Container>
        <Button type="submit" variant="outlined" sx={breakpointsRegisterPlayerButton}>
          {'Register'}
        </Button>
      </Form>
    </Formik>
  );
}
