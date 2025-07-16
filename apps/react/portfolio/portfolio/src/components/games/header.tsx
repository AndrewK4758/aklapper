import { ColoredBackground, Text } from '@aklapper/react-shared';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import { css } from '@pigment-css/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BODY, TITLE } from '../../pages/static/games-text';
import Theme from '../../styles/themes/theme';

interface GamesHeaderProps {
  state: 'loading' | 'idle' | 'submitting';
}

export default function GamesHeader({ state }: GamesHeaderProps) {
  const [textView, setTextView] = useState(false);
  const nav = useNavigate();

  const handleClickTextView = () => {
    setTextView(!textView);
  };

  return (
    <ColoredBackground
      as={'div'}
      id='games-navbar-container'
      className={css({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: `${Theme.spacing(4)} 0`,
      })}
    >
      <Box as={'div'} className={css({ display: 'flex' })}>
        <Box
          as={'section'}
          id='games-title-wrapper'
          className={css({ padding: Theme.spacing(4), flex: '1 1 auto', alignSelf: 'flex-start' })}
        >
          <Text variant='h3' children={TITLE} />
        </Box>
        <Divider flexItem orientation='vertical' />
        <Box
          className={css({
            flex: '1 0 auto',
            display: 'flex',
            alignItems: 'flex-start',
            padding: `0 ${Theme.spacing(4)}`,
          })}
        >
          <ButtonGroup id='games-button-group' orientation='vertical' size='large' sx={{ alignSelf: 'center' }}>
            <Button
              name='Chutes-&-Ladders'
              variant='outlined'
              disabled={state !== 'idle'}
              onClick={e => nav(e.currentTarget.name, { relative: 'route', replace: true })}
            >
              Chutes & Ladders
            </Button>

            <Button
              name='Tic-Tac-Toe'
              variant='outlined'
              disabled={state !== 'idle'}
              onClick={e => nav(e.currentTarget.name, { relative: 'route', replace: true })}
            >
              Tic Tac Toe
            </Button>
          </ButtonGroup>
        </Box>
        <Divider flexItem orientation='vertical' />
        <Box className={css({ flex: '1 1 auto', alignSelf: 'center' })}>
          <Box className={css({ display: 'flex', justifyContent: 'center', padding: `0 ${Theme.spacing(4)}` })}>
            <Text variant='h3' children='Description' />
            <IconButton onClick={handleClickTextView}>
              {textView ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
            </IconButton>
          </Box>
        </Box>
      </Box>
      <Collapse in={textView}>
        <Text
          id='game-header-text-left'
          variant='body1'
          children={BODY}
          className={css({ textAlign: 'start', lineHeight: 1.5, padding: `${Theme.spacing(4)}` })}
        />
      </Collapse>
    </ColoredBackground>
  );
}
