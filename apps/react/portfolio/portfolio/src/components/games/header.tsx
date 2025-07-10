import { ColoredBackground, Text } from '@aklapper/react-shared';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import { useState } from 'react';
import { useSubmit, type SubmitFunction } from 'react-router';
import { BODY, TITLE } from '../../pages/static/games-text';
import Theme from '../../styles/themes/theme';

interface GamesHeaderProps {
  state: 'loading' | 'idle' | 'submitting';
  setLoading: (loading: boolean) => void;
}

export default function GamesHeader({ state, setLoading }: GamesHeaderProps) {
  const [textView, setTextView] = useState(false);
  const submit = useSubmit();

  const handleClickTextView = () => {
    setTextView(!textView);
  };

  return (
    <ColoredBackground
      as={'div'}
      id='games-navbar-container'
      sx={{
        flex: 1,
        display: 'flex',
        paddingY: Theme.spacing(4),
      }}
    >
      <Box
        as={'section'}
        id='games-title-wrapper'
        sx={{ p: Theme.spacing(4), flex: '0 1 30%', alignSelf: 'flex-start' }}
      >
        <Text variant='h3' children={TITLE} />
      </Box>

      <Box sx={{ flex: '0 1 35%', height: 'fit-content' }}>
        <ButtonGroup id='games-button-group' orientation='vertical' size='large'>
          <Button
            name='Chutes-&-Ladders'
            variant='outlined'
            disabled={state !== 'idle'}
            onClick={async e => await loadAndStartGame(e.currentTarget.name, submit, setLoading, setTextView)}
          >
            Chutes & Ladders
          </Button>

          <Button
            name='Tic-Tac-Toe'
            variant='outlined'
            disabled={state !== 'idle'}
            onClick={async e => await loadAndStartGame(e.currentTarget.name, submit, setLoading, setTextView)}
          >
            Tic Tac Toe
          </Button>
        </ButtonGroup>
      </Box>
      <Box sx={{ flex: '0 1 35%', alignSelf: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Text variant='h3' children='Description' />
          <IconButton onClick={handleClickTextView}>
            {textView ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
          </IconButton>
        </Box>
        <Collapse in={textView}>
          <Text
            id='game-header-text-left'
            variant='body1'
            children={BODY}
            sx={{ textAlign: 'start', lineHeight: 1.5, paddingX: Theme.spacing(4) }}
          />
        </Collapse>
      </Box>
    </ColoredBackground>
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
