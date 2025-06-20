import { RenderList, Text } from '@aklapper/react-shared';
import type { IRegisterFormValues } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import {
  activeAvatarsActiveGameHeaderBoxSxProps,
  breakpointsActiveGameTitleContainer,
  breakpointsActiveGameTitleText,
  breakpointsPlayersBox,
  breakpointsPlayersInGameBox,
  breakpointsPlayersInGameText,
} from '../../../styles/games-styles.jsx';
import PlayersInGame from '../players-in-game/players-in-game.jsx';

/**
 *
 * @param e Player
 * @param _i index of player array
 * @param _arr Player array
 * @returns an active player/avatar in in the active avatar list
 */

const playersInGameMap = (e: IRegisterFormValues, _i: number, _arr: IRegisterFormValues[]) => (
  <PlayersInGame
    key={e.avatarName}
    component={'span'}
    id={e.playerName}
    boxSx={breakpointsPlayersBox}
    textSx={breakpointsPlayersInGameText}
    playerVariant='h4'
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
          sx={activeAvatarsActiveGameHeaderBoxSxProps}
        >
          <Box
            component={'section'}
            key={'active-game-header-text-box'}
            id={'active-game-header-text-box'}
            alignContent={'center'}
          >
            <Text variant='h2' children='Active Players in Game' sx={breakpointsActiveGameTitleText} />
          </Box>
          <Box component={'section'} sx={breakpointsPlayersInGameBox}>
            <RenderList data={avatarsInGame} listMapCallback={playersInGameMap} />
          </Box>
        </Box>
      ) : (
        <Box component={'section'} sx={{ flex: '1 0 70%' }}>
          <Text variant='h2' children={winner} sx={breakpointsActiveGameTitleText} />
        </Box>
      )}
    </Container>
  );
}
