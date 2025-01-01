// import styles from './players-in-game.module.css';
import { Box, SxProps } from '@mui/material';
import { Variant } from '@mui/material/styles/createTypography';
import type { ElementType } from 'react';
import { Text } from '@aklapper/react-shared';
import { avatarSvgStyle } from '../../../styles/games-styles';

export interface PlayersInGameProps {
  component: ElementType;
  id: string | number;
  boxSx?: SxProps;
  textSx: SxProps;
  playerVariant: Variant;
  playerName: string;
  avatarName: string;
}

/**
 *
 * @param param0 Params needed to populate the list of players in game with avatars
 * @returns list of players in game with avatars
 */

export const PlayersInGame = ({
  component,
  id,
  boxSx,
  textSx,
  playerVariant,
  playerName,
  avatarName
}: PlayersInGameProps) => (
  <Box component={component} key={id} width={'fit-content'} whiteSpace={'preserve'} sx={boxSx}>
    <Text component={'p'} titleVariant={playerVariant} titleText={playerName} sx={textSx} />
    <img
      src={`/game-avatars/${avatarName.toLowerCase()}.svg`}
      alt={`${avatarName} active in game`}
      style={avatarSvgStyle}
    />
  </Box>
);

export default PlayersInGame;
