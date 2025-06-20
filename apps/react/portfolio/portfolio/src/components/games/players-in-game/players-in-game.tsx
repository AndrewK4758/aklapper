import { Text } from '@aklapper/react-shared';
import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import { avatarSvgStyle } from '../../../styles/games-styles.jsx';

export interface PlayersInGameProps extends BoxProps {
  boxSx?: SxProps;
  textSx: SxProps;
  playerVariant: TypographyVariant;
  playerName: string;
  avatarName: string;
}

/**
 *
 * @returns list of players in game with avatars
 */

export const PlayersInGame = ({ textSx, playerVariant, playerName, avatarName, ...props }: PlayersInGameProps) => (
  <Box {...props} key={props.id} width={'fit-content'} whiteSpace={'preserve'}>
    <Text variant={playerVariant} children={playerName} sx={textSx} />
    <img
      src={`/client/game-avatars/${avatarName.toLowerCase()}.svg`}
      alt={`${avatarName} active in game`}
      style={avatarSvgStyle}
    />
  </Box>
);

export default PlayersInGame;
