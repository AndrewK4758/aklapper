import { RenderList, Text } from '@aklapper/react-shared';
import { IBuiltGame, IRule } from '@aklapper/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import { SxProps } from '@mui/material/styles';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate, useParams, useRouteLoaderData } from 'react-router';
import HeadingWithDetails from '../components/header/heading-with-details';
import RegisterGame from '../components/register-game/register_game';
import GamesTheme from '../styles/games-theme';

const breakpointsGameDetailsTitle: SxProps = {
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '4rem'
  }
};

const breakpointsGameDetailsListTitle: SxProps = {
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '2rem'
  }
};

const breakpointsGameDetailsListValue: SxProps = {
  paddingX: '1rem',
  backgroundColor: GamesTheme.palette.background.default,
  borderRadius: 1,
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '1rem'
  }
};

const breakpointsGameDetailsRegisterButton: SxProps = {
  animation: 'blink 3s infinite',
  '@keyframes blink': {
    '50%': {
      color: GamesTheme.palette.secondary.main,
      backgroundColor: GamesTheme.palette.primary.contrastText
    }
  },

  [GamesTheme.breakpoints.down('md')]: {
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
}

const GameDetails = ({ open, setOpen }: GameDetailsProps) => {
  const loader = useRouteLoaderData('gameList') as IBuiltGame[];
  const selectedName = useParams().id?.replace(/-/g, ' ');
  const nav = useNavigate();

  const selectedGame = loader.find(({ name }) => name === selectedName);

  if (selectedGame) {
    const gameDetails: IRule[] = selectedGame.rules;
    return (
      <Dialog open={open} fullWidth maxWidth={'md'}>
        <Container
          component={'div'}
          fixed={false}
          maxWidth={false}
          sx={{ flexDirection: 'column', marginTop: '1.5rem' }}
        >
          <Text component={'h5'} titleVariant="h5" titleText={selectedName} sx={breakpointsGameDetailsTitle} />
          <RenderList component={'ul'} data={gameDetails} listMapCallback={listRulesCallback} />
          <Box>
            <Button
              onClick={() => {
                setOpen(false);
                nav(-1);
              }}
            >
              Close
            </Button>
            <RegisterGame registerGameButtonSx={breakpointsGameDetailsRegisterButton} />
          </Box>
        </Container>
      </Dialog>
    );
  } else
    return (
      <Dialog open={open}>
        <Text component={'h1'} titleVariant="h1" titleText={'GAME DOES NOT EXIST --- OR ERROR --- OR SOMETHING ELSE'} />
      </Dialog>
    );
};

export default GameDetails;
