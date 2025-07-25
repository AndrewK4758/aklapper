import { RenderList, Text } from '@aklapper/react-shared';
import type { IRegisterFormValues } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import { Fragment } from 'react/jsx-runtime';
import { GamesTheme as Theme } from '../../styles/games-theme';
import { PlayersInGame } from '../players-in-game/players-in-game';

const breakpointsActiveGameTitleContainer: SxProps = {
  flex: '0 1 80%',
  [Theme.breakpoints.down('md')]: {
    flex: '1 0 60%',
  },
};

const breakpointsActiveGameTitleText: SxProps = {
  textAlign: 'start',
  flex: '1 0 45%',
  [Theme.breakpoints.down('md')]: {
    flex: '1 0 100%',
    fontSize: '1.5rem',
    textAlign: 'center',
  },
};

const breakpointsPlayersInGameBox: SxProps = {
  flex: '1 0 55%',
  display: 'flex',
  flexWrap: 'wrap',
  flexDirection: 'row',
  height: '100%',
  [Theme.breakpoints.down('md')]: {},
};

const breakpointsPlayersBox: SxProps = {
  flex: '1 0 50%',
  display: 'flex',
  flexDirection: 'row',
  [Theme.breakpoints.down('md')]: {},
};

const breakpointsPlayersInGameText: SxProps = {
  flex: '0 1 auto',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

const playersInGameMap = (e: IRegisterFormValues, _i: number, _arr: IRegisterFormValues[]) => (
  <Fragment key={e.avatarName}>
    <PlayersInGame
      component={'span'}
      id={e.playerName}
      boxSx={breakpointsPlayersBox}
      textSx={{ color: e.avatarColor, ...breakpointsPlayersInGameText }}
      playerVariant='body1'
      playerName={`${e.playerName}: `}
      avatarName={e.avatarName}
    />
  </Fragment>
);

interface ActiveAvatarsProps {
  avatarsInGame: IRegisterFormValues[];
  winner: string | undefined;
}

export default function ActiveAvatars({ avatarsInGame, winner }: ActiveAvatarsProps) {
  return (
    <Container component={'section'} sx={breakpointsActiveGameTitleContainer}>
      <Text variant='h2' children='Active Players in Game' sx={breakpointsActiveGameTitleText} />
      {!winner ? (
        <Box sx={breakpointsPlayersInGameBox}>
          <RenderList data={avatarsInGame} listMapCallback={playersInGameMap} />
        </Box>
      ) : (
        <Text variant='h2' children={winner} sx={breakpointsActiveGameTitleText} />
      )}
    </Container>
  );
}
