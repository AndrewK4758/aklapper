import { RenderList, Text } from '@aklapper/react-shared';
import { IBuiltGame, IRule } from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import { SxProps } from '@mui/material/styles';
import type { Dispatch, SetStateAction } from 'react';
import HeadingWithDetails from '../components/header/heading-with-details';
import RegisterGame from '../components/register-game/register_game';
import { GamesTheme as Theme } from '../styles/games-theme';

const breakpointsGameDetailsTitle: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem'
  }
};

const breakpointsGameDetailsListTitle: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '2rem'
  }
};

const breakpointsGameDetailsListValue: SxProps = {
  paddingX: '1rem',
  backgroundColor: Theme.palette.background.default,
  borderRadius: 1,
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem'
  }
};

const breakpointsGameDetailsRegisterButton: SxProps = {
  animation: 'blink 3s infinite',
  '@keyframes blink': {
    '50%': {
      color: Theme.palette.secondary.main,
      backgroundColor: Theme.palette.primary.contrastText
    }
  },

  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
    width: '130px',
    height: '35px'
  }
};

const listRulesCallback = (e: IRule, _i: number, _arr: IRule[]) => (
  <HeadingWithDetails
    key={e.title}
    component={'li'}
    id={e.order}
    titleVariant="h2"
    titleText={e.title}
    titleSx={breakpointsGameDetailsListTitle}
    valueVariant="body1"
    valueText={e.value}
    valueSx={breakpointsGameDetailsListValue}
  />
);

interface GameDetailsProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  selectedGame: IBuiltGame | null;
}

const GameDetails = ({ open, setOpen, selectedGame }: GameDetailsProps) => {
  const gameDetails: IRule[] = selectedGame ? selectedGame.rules : [];

  console.log(selectedGame);
  return (
    <Dialog open={open} fullWidth maxWidth={'md'}>
      <Container component={'div'} fixed={false} maxWidth={false} sx={{ flexDirection: 'column', marginTop: '1.5rem' }}>
        <Text component={'h5'} titleVariant="h5" titleText={selectedGame?.name} sx={breakpointsGameDetailsTitle} />
        <RenderList component={'ul'} data={gameDetails} listMapCallback={listRulesCallback} />
        <Box>
          <Button
            onClick={() => {
              setOpen(false);
            }}
          >
            Close
          </Button>
          <RegisterGame registerGameButtonSx={breakpointsGameDetailsRegisterButton} />
        </Box>
      </Container>
    </Dialog>
  );
};

export default GameDetails;
