import { Text } from '@aklapper/react-shared';
import type { IRegisterFormValues } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
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
    <Box as={'section'} sx={{ width: '100%', height: '100%' }}>
      {!winner ? (
        <Box
          as={'section'}
          id={'active-game-header'}
          sx={{
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Text variant='h4' children='Active Players in Game' sx={{ height: '100%' }} />
          {avatarsInGame.map(avatar => (
            <PlayersInGame key={avatar.avatarName} avatarName={avatar.avatarName} playerName={avatar.playerName} />
          ))}
        </Box>
      ) : (
        <Text
          variant='h4'
          children={winner}
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '71px',
            justifySelf: 'center',
          }}
        />
      )}
    </Box>
  );
}
