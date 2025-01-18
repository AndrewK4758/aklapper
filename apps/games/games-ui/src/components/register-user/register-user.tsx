// import styles from './register-user.tsx.module.css';
import { ActionError, FormikTextInput, IActionError, Text } from '@aklapper/react-shared';
import { IRegisterUserClient } from '@aklapper/types-api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputLabel from '@mui/material/InputLabel';
import { Form, Formik, FormikProps } from 'formik';
import { ChangeEvent, Fragment, MouseEvent, useState } from 'react';
import registerUserAction from '../../services/register-user/actions/register-user-action';
import updateFormOnChange from '../../services/register-user/events/add-file-to-form-on-change';
import verifyEmailObBlur from '../../services/register-user/events/verify-email-on-blur';
import {
  breakpointsButtonSx,
  breakpointsLabelSx,
  breakpointsTextBoxSx,
  inputStyle
} from '../../styles/register-user-css-sx-props';
import { initialValues, supportedFormat, validationSchema } from './validation-schema';
import GamesTheme from '../../styles/games-theme';

type Anchor = 'right';

interface RegisterUserProps {
  toggleDrawer: (anchor: Anchor, open: boolean) => (event: MouseEvent) => void;
  anchor: Anchor;
}

export const RegisterUser = ({ toggleDrawer, anchor }: RegisterUserProps) => {
  const [blurString, setBlurString] = useState<string>('');
  const [registerError, setRegisterError] = useState<IActionError | null>(null);

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={values => registerUserAction(values, setRegisterError)}
    >
      {formik => (
        <Form method={'POST'} encType="multipart/form-data">
          <FormikTextInput
            Theme={GamesTheme}
            autoComplete="on"
            labelComponent={'h3'}
            label="First Name"
            id="firstName"
            type={'text'}
            placeholder="Enter First Name Here"
            name={'firstName'}
            textSx={breakpointsTextBoxSx}
            labelSx={breakpointsLabelSx}
          />
          <FormikTextInput
            Theme={GamesTheme}
            autoComplete="on"
            labelComponent={'h3'}
            label="Last Name"
            id="lastName"
            type={'text'}
            placeholder="Enter Last Name Here"
            name={'lastName'}
            textSx={breakpointsTextBoxSx}
            labelSx={breakpointsLabelSx}
          />
          <FormikTextInput
            Theme={GamesTheme}
            autoComplete="new-email"
            labelComponent={'h3'}
            label="Email"
            id="email"
            type={'text'}
            placeholder="Enter Email Here"
            name={'email'}
            textSx={breakpointsTextBoxSx}
            labelSx={breakpointsLabelSx}
            onBlurCB={e => verifyEmailObBlur(e, setBlurString)}
          />
          <br />
          {blurString}
          <FormikTextInput
            Theme={GamesTheme}
            autoComplete="on"
            labelComponent={'h3'}
            label="Player Name"
            id="playerName"
            type={'text'}
            placeholder="Enter Player Name Here"
            name={'playerName'}
            textSx={breakpointsTextBoxSx}
            labelSx={breakpointsLabelSx}
          />
          <FormikTextInput
            Theme={GamesTheme}
            autoComplete="on"
            labelComponent={'h3'}
            label="Password"
            id="password"
            type="password"
            placeholder="Enter Password Here"
            name="password"
            textSx={breakpointsTextBoxSx}
            labelSx={breakpointsLabelSx}
          />
          <br />
          <Fragment key={'file-input'}>
            <InputLabel component={'h3'} variant="filled" sx={breakpointsLabelSx}>
              Upload Picture
            </InputLabel>
            <input
              name="thumbnail"
              id="thumbnail"
              type="file"
              accept={supportedFormat.map(type => `image/${type}, `).join(',')}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateFormOnChange(e, formik as FormikProps<IRegisterUserClient>)
              }
              style={inputStyle}
            />
            <br />

            {formik.errors.thumbnail && formik.touched.thumbnail ? (
              <Text component={'p'} sx={breakpointsLabelSx} titleVariant="body1" titleText={formik.errors.thumbnail} />
            ) : null}
          </Fragment>

          <br />
          <Box component={'div'} style={{ whiteSpace: 'balance' }}>
            {registerError ? <ActionError errorMessage={registerError.errorMessage} /> : undefined}
          </Box>
          <br />
          <Button type={'submit'} variant={'outlined'} sx={breakpointsButtonSx} onClick={toggleDrawer(anchor, false)}>
            {'Register'}
          </Button>
          <Button type="reset" variant="outlined" sx={breakpointsButtonSx} onReset={formik.handleReset}>
            {'Reset'}
          </Button>
        </Form>
      )}
    </Formik>
  );
};

export default RegisterUser;
