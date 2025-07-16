import { Text } from '@aklapper/react-shared';
import type { IRegisterFormValues } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import PlayersInGame from '../players-in-game/players-in-game';

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
    <Box
      as={'section'}
      id={'active-game-header'}
      key={'games-header'}
      className={css({ display: 'flex', height: '100%', width: '100%' })}
    >
      {!winner ? (
        <Box
          className={css({
            flex: 1,
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            height: '100%',
          })}
        >
          <Box className={css({ flex: '1 0 35%' })}>
            <Text variant='h4' children='Active Players in Game' />
          </Box>
          <Box className={css({ flex: '1 0 65%', display: 'flex' })}>
            {avatarsInGame.map(avatar => (
              <PlayersInGame key={avatar.avatarName} avatarName={avatar.avatarName} playerName={avatar.playerName} />
            ))}
          </Box>
        </Box>
      ) : (
        <Text
          variant='h4'
          children={winner}
          className={css({
            display: 'flex',
            alignItems: 'center',
            height: '71px',
            justifySelf: 'center',
          })}
        />
      )}
    </Box>
  );
}
