import { FormikTextInput, SelectMenu } from '@aklapper/react-shared';
import { AvatarTotem, Color, ILoadRegisterData, type IRegisterFormValues } from '@aklapper/types';
import { SxProps } from '@mui/material';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import { useFormik } from 'formik';
import { CSSProperties } from 'react';
import { Form, useParams, useRouteLoaderData, useSubmit } from 'react-router';
import * as Yup from 'yup';
import { errorTextSx, selectSlotProps, tooltipSx } from '../../styles/games-styles';
import { GamesTheme as Theme } from '../../styles/games-theme';

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
  width: '100%',

  backgroundColor: Theme.palette.info.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '20px',
    height: 45,
    width: 200
  }
};

const breakpointsRegisterPlayerSelectInput: SxProps = {
  textAlign: 'center',
  backgroundColor: Theme.palette.info.main,
  display: 'flex',
  [Theme.breakpoints.down('md')]: {
    fontSize: '19px',
    height: 45,
    width: 200
  }
};

const breakpointsFormContianer: SxProps = {
  textAlign: 'start',
  flexDirection: 'column',
  gap: 2,
  padding: '1rem',
  width: 'fit-content',
  border: 5,
  [Theme.breakpoints.down('md')]: {
    alignContent: 'center'
  }
};

const breakpointsAvatarPicture: CSSProperties = {
  width: '64px',
  height: '64px'
};

const initialValues: IRegisterFormValues = {
  playerName: '',
  avatarName: '',
  avatarColor: Color.UNDEFINED,
  avatarImage: undefined
};

const avatarColorMap = (e: Color, _i: number, _arr: string[]) => (
  <MenuItem key={e} LinkComponent={'option'} id={e} value={e} divider={true} sx={breakpointsSelectMenuSxProps}>
    {e}
  </MenuItem>
);

const avatarListMap = (e: AvatarTotem, _i: number, _arr: AvatarTotem[]) => (
  <MenuItem
    key={e.name}
    id={e.name}
    LinkComponent={'option'}
    value={e.name}
    divider={true}
    sx={breakpointsSelectMenuSxProps}
  >
    {e.name}
    <img src={`./game-avatars/${e.image}`} alt={`${e.name} avatar`} style={breakpointsAvatarPicture} />
  </MenuItem>
);

export default function RegisterPlayerAndAvatarForm() {
  const params = useParams();
  const submit = useSubmit();
  const data = useRouteLoaderData('registerData') as ILoadRegisterData;

  const validationSchema: Yup.ObjectSchema<IRegisterFormValues> = Yup.object().shape({
    playerName: Yup.string()
      .min(2, 'Must be min of 2 characters')
      .max(20, 'Must be 20 characters or less')
      .required('Required, please enter player name'),
    avatarName: Yup.string().required('Required, please select avatar name'),
    avatarColor: Yup.string().oneOf(Object.values(Color)).required('Required, please select avatar color'),
    avatarImage: Yup.string()
  });

  const colors = Object.values(data.avatarColorList) as Color[];
  const avatars = data.avatarList as AvatarTotem[];

  const id = params.id;

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: values => submit(values, { method: 'patch', action: `/games/${id}/play`, encType: 'application/json' })
  });

  return (
    <Form method="POST" action={`play`} onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <Container component={'section'} sx={breakpointsFormContianer}>
        <FormikTextInput<IRegisterFormValues>
          id="player-name"
          autoComplete="off"
          labelComponent={'body1'}
          type="text"
          name="playerName"
          label="Player Name"
          textSx={breakpointsRegisterPlayerTextInput}
          labelSx={breakpointsRegisterPlayerLabel}
          formik={formik}
          valueField={'playerName'}
          errorTextSx={errorTextSx}
          tooltipTitle={'Enter Player Name'}
          tooltipSx={tooltipSx}
        />
        <SelectMenu<IRegisterFormValues>
          formik={formik}
          id="avatar-name"
          name="avatarName"
          label="Avatar Name"
          data={avatars}
          mapCallback={avatarListMap}
          labelSx={breakpointsRegisterPlayerLabel}
          selectSx={breakpointsRegisterPlayerSelectInput}
          tooltipTitle={'Select Avatar'}
          labelVariant={'body1'}
          labelWrapperSx={null}
          tooltipSx={tooltipSx}
          errorTextSx={errorTextSx}
          selectSlotProps={selectSlotProps}
        />
        <SelectMenu<IRegisterFormValues>
          formik={formik}
          id="avatar-color"
          name="avatarColor"
          label="Avatar Color"
          data={colors}
          mapCallback={avatarColorMap}
          labelSx={breakpointsRegisterPlayerLabel}
          selectSx={breakpointsRegisterPlayerSelectInput}
          tooltipTitle={'Select Avatar Color'}
          labelVariant={'body1'}
          labelWrapperSx={null}
          tooltipSx={tooltipSx}
          errorTextSx={errorTextSx}
          selectSlotProps={selectSlotProps}
        />
      </Container>
      <Button type="submit" variant="outlined" sx={breakpointsRegisterPlayerButton}>
        {'Register'}
      </Button>
    </Form>
  );
}
