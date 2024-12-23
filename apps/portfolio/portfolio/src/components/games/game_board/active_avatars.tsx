import { Player } from '@aklapper/games-components';
import PlayersInGame from '../players-in-game/players-in-game';
import { RenderList, Text } from '@aklapper/react-shared';
import { IRegisterFormValues } from '@aklapper/types-game';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import Theme from '../../../styles/theme';

const breakpointsActiveGameTitleContainer: SxProps = {
  flex: '0 1 80%',
  [Theme.breakpoints.down('md')]: {
    flex: '1 0 60%'
  }
};

const breakpointsActiveGameTitleText: SxProps = {
  textAlign: 'start',
  flex: '1 0 45%',
  [Theme.breakpoints.down('md')]: {
    flex: '1 0 100%',
    fontSize: '1.5rem',
    textAlign: 'center'
  }
};

const breakpointsPlayersInGameBox: SxProps = {
  flex: '1 0 55%',
  display: 'flex',
  flexWrap: 'wrap',
  flexDirection: 'row',
  height: '100%',
  [Theme.breakpoints.down('md')]: {}
};

const breakpointsPlayersBox: SxProps = {
  flex: '1 0 50%',
  display: 'flex',
  flexDirection: 'row',
  [Theme.breakpoints.down('md')]: {}
};

const breakpointsPlayersInGameText: SxProps = {
  flex: '0 1 auto',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem'
  }
};
/**
 *
 * @param e Player
 * @param _i index of player array
 * @param _arr Player array
 * @returns an active player/avatar in in the active avatar list
 */

const playersInGameMap = (e: IRegisterFormValues, _i: number, _arr: Player[]) => (
  <PlayersInGame
    key={e.avatarName}
    component={'span'}
    id={e.playerName}
    boxSx={breakpointsPlayersBox}
    textSx={{ ...breakpointsPlayersInGameText, color: '#cb91ff' }}
    playerVariant="h4"
    playerName={`${e.playerName}: `}
    avatarName={e.avatarName}
  />
);

interface ActiveAvatarsProps {
  avatarsInGame: IRegisterFormValues[];
  winner: string | undefined;
}

/**
 *
 * @param avatarsInGame: Array of avatars in active game
 * @param winner: string showing winning player
 * @returns List of active avatars in game
 */

export default function ActiveAvatars({ avatarsInGame, winner }: ActiveAvatarsProps) {
  return (
    <Container component={'section'} maxWidth={false} sx={breakpointsActiveGameTitleContainer}>
      {!winner ? (
        <Box
          component={'section'}
          key={'active-game-header'}
          id={'active-game-header'}
          sx={{ display: 'flex', justifyContent: 'center' }}
        >
          <Box
            component={'section'}
            key={'active-game-header-text-box'}
            id={'active-game-header-text-box'}
            alignContent={'center'}
          >
            <Text
              component={'h2'}
              titleVariant="h2"
              titleText="Active Players in Game"
              sx={breakpointsActiveGameTitleText}
            />
          </Box>
          <Box component={'section'} sx={breakpointsPlayersInGameBox}>
            <RenderList
              data={avatarsInGame}
              listMapCallback={playersInGameMap}
              sx={{ display: 'flex', justifyContent: 'center' }}
            />
          </Box>
        </Box>
      ) : (
        <Box component={'section'} sx={{ flex: '1 0 70%' }}>
          <Text component={'h2'} titleVariant="h2" titleText={winner} sx={breakpointsActiveGameTitleText} />
        </Box>
      )}
    </Container>
  );
}
