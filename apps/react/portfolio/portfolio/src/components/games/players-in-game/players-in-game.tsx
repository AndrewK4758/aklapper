import { Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';

export interface PlayersInGameProps {
  playerName: string;
  avatarName: string;
}

/**
 *
 * @returns list of players in game with avatars
 */

export const PlayersInGame = ({ playerName, avatarName }: PlayersInGameProps) => (
  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <Text variant={'h5'} children={playerName} />
    <img
      src={`/game-avatars/${avatarName.toLowerCase()}.webp`}
      alt={`${avatarName} active in game`}
      style={{
        height: 'auto',
        width: '25%',
        maxWidth: '90px',
      }}
    />
  </Box>
);

export default PlayersInGame;
