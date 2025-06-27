import { Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import { avatarSvgStyle } from '../../../styles/games-styles.jsx';

export interface PlayersInGameProps {
  playerName: string;
  avatarName: string;
}

/**
 *
 * @returns list of players in game with avatars
 */

export const PlayersInGame = ({ playerName, avatarName }: PlayersInGameProps) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <Text variant={'h5'} children={playerName} />
    <img
      src={`/game-avatars/${avatarName.toLowerCase()}.svg`}
      alt={`${avatarName} active in game`}
      style={avatarSvgStyle}
    />
  </Box>
);

export default PlayersInGame;
