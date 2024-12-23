// import styles from './login.module.css';
import { ActionError, FormikTextInput, IActionError } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import { Form, Formik } from 'formik';
import { MouseEvent, useContext, useState } from 'react';
import { ActiveUserContext } from '../../context/active-user-context';
import loginUserAction from '../../services/login/actions/login-user-action';
import verifyEmailOnBlur from '../../services/login/events/verify-login-email-on-blur';
import { breakpointsButtonSx, breakpointsLabelSx, breakpointsTextBoxSx } from '../../styles/login-sx-props';
import { initialValues, LoginDataProps, validationSchema } from './login-validation-schema';
import GamesTheme from '../../styles/games-theme';

type Anchor = 'right';

interface LoginProps {
  toggleDrawer: (anchor: Anchor, open: boolean) => (event: MouseEvent) => void;
  anchor: Anchor;
}

export const Login = ({ toggleDrawer, anchor }: LoginProps) => {
  const [loginError, setLoginError] = useState<IActionError>({ errorMessage: '' });
  const [noEmailError, setNoEmailError] = useState<string>('');
  const { setActiveUser } = useContext(ActiveUserContext);

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values: LoginDataProps) => loginUserAction(values, setActiveUser, setLoginError)}
    >
      <Form method="PATCH">
        <FormikTextInput
          autoComplete="on"
          labelComponent={'h2'}
          label="Email"
          id="email"
          type="email"
          placeholder="Enter Email Here"
          name="email"
          Theme={GamesTheme}
          textSx={breakpointsTextBoxSx}
          labelSx={breakpointsLabelSx}
          onBlurCB={e => verifyEmailOnBlur(e, setNoEmailError)}
        />
        <br />
        {noEmailError && <ActionError errorMessage={noEmailError} />}
        <FormikTextInput
          autoComplete="on"
          labelComponent={'h2'}
          label="Password"
          id="password"
          type="password"
          placeholder="Enter Password Here"
          name="password"
          Theme={GamesTheme}
          textSx={breakpointsTextBoxSx}
          labelSx={breakpointsLabelSx}
        />
        <br />
        {loginError && <ActionError errorMessage={loginError.errorMessage} />}
        <br />
        <Button type="submit" variant="outlined" sx={breakpointsButtonSx} onClick={toggleDrawer(anchor, false)}>
          {'Login'}
        </Button>
        <Button type="reset" variant="outlined" sx={breakpointsButtonSx}>
          {'Reset'}
        </Button>
      </Form>
    </Formik>
  );
};

export default Login;
