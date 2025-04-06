import { RenderList } from '@aklapper/react-shared';
import type { IBuiltGame, IRule } from '@aklapper/types';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { SxProps } from '@mui/material/styles';
import type { Dispatch, SetStateAction } from 'react';
import GameRulesList from '../components/header/heading-with-details';
import RegisterGame from '../components/register-game/register_game';
import { __greyPaper, __infoLight } from '../styles/colors';
import { GamesTheme as Theme } from '../styles/games-theme';

const breakpointsGameDetailsTitle: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem',
  },
};

const breakpointsGameDetailsListTitle: SxProps = {
  [Theme.breakpoints.down('md')]: {},
};

const breakpointsGameDetailsListValue: SxProps = {
  backgroundColor: __greyPaper,
  color: __infoLight,
  borderRadius: 1,
  p: 1,
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

const breakpointsGameDetailsRegisterButton: SxProps = {
  animation: 'blink 3s infinite',
  '@keyframes blink': {
    '50%': {
      color: Theme.palette.secondary.main,
      backgroundColor: Theme.palette.primary.contrastText,
    },
  },

  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
    width: '130px',
    height: '35px',
  },
};

const listRulesCallback = (e: IRule, _i: number, _arr: IRule[]) => (
  <GameRulesList
    key={e.title}
    id={`rule-${e.title}`}
    titleText={e.title}
    titleSx={breakpointsGameDetailsListTitle}
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
  const gameName = selectedGame?.name as string;
  return (
    <Dialog open={open} fullWidth maxWidth={'md'}>
      <DialogTitle component={'h2'} variant='h2' sx={breakpointsGameDetailsTitle}>
        {selectedGame?.name}
      </DialogTitle>

      <DialogContent>
        <RenderList<IRule> data={gameDetails} listMapCallback={listRulesCallback} />
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() => {
            setOpen(false);
          }}
        >
          Close
        </Button>
        <RegisterGame
          gameName={gameName}
          setOpen={setOpen}
          registerGameButtonSx={breakpointsGameDetailsRegisterButton}
        />
      </DialogActions>
    </Dialog>
  );
};

export default GameDetails;
