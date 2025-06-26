import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import { useSubmit, type SubmitFunction } from 'react-router';
import { title } from '../../pages/static/games-text';
import NavButton from '../navigation/nav_button';

interface GamesHeaderProps {
  state: 'loading' | 'idle' | 'submitting';
  setLoading: (loading: boolean) => void;
  setTextView: (loading: boolean) => void;
}

export default function GamesHeader({ state, setLoading, setTextView }: GamesHeaderProps) {
  const submit = useSubmit();

  return (
    <Container component={'div'} id='games-navbar-container'>
      <Box component={'section'} id='games-title-wrapper'>
        <Text variant='h2' children={title} />
      </Box>
      <ButtonGroup id='games-button-group' key={'games-button-group'} color='primary'>
        <NavButton
          name='Chutes-&-Ladders'
          variant='outlined'
          disabled={state !== 'idle'}
          onClick={async e => loadAndStartGame(e.currentTarget.name, submit, setLoading, setTextView)}
          buttonText={'Chutes & Ladders'}
          title={`Clicking the button executes the following actions: \n- Starts the Chutes & Ladders instance\n- Registers 2 "Guest" Players\n- Automatically starts the game`}
        />

        <NavButton
          name='Tic-Tac-Toe'
          variant='outlined'
          disabled={state !== 'idle'}
          onClick={async e => loadAndStartGame(e.currentTarget.name, submit, setLoading, setTextView)}
          buttonText='Tic Tac Toe'
          title={`Clicking the button executes the following actions: \n- Starts the Tic Tac Toe instance\n- Registers "X" & "O" Players\n- Automatically starts the game`}
        />
      </ButtonGroup>
    </Container>
  );
}

async function loadAndStartGame(
  gameName: string,
  submit: SubmitFunction,
  setLoading: (loading: boolean) => void,
  setTextView: (loading: boolean) => void,
) {
  try {
    setTextView(false);
    setLoading(true);
    await submit(gameName, {
      method: 'post',
      encType: 'text/plain',
      relative: 'path',
      replace: true,
    });
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
}
