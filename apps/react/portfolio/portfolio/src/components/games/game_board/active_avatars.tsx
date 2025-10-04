import { Text } from '@aklapper/react-shared';
import type { IRegisterFormValues } from '@aklapper/types';
import Box from '@mui/material/Box';
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
      component={'section'}
      id={'active-game-header'}
      key={'games-header'}
      sx={{ display: 'flex', height: '100%', width: '100%' }}
    >
      {!winner ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Box sx={{ flex: '1 0 35%' }}>
            <Text variant='h4' children='Active Players in Game' />
          </Box>
          <Box sx={{ flex: '1 0 65%', display: 'flex' }}>
            {avatarsInGame.map(avatar => (
              <PlayersInGame key={avatar.avatarName} avatarName={avatar.avatarName} playerName={avatar.playerName} />
            ))}
          </Box>
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
