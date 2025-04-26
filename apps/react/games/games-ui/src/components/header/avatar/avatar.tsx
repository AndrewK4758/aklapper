import type { IPlayerClientData } from '@aklapper/types';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import { avatarStyleBoxSx, avatarSx, avatarWrapperSx } from '../../../styles/header-styles';

interface HeaderAvatarProps {
  activePlayer: IPlayerClientData;
}

export default function HeaderAvatar({ activePlayer }: HeaderAvatarProps) {
  return (
    <Box component={'section'} id='active-avatar-wrapper' sx={avatarWrapperSx}>
      <Box component={'section'} id='active-avatar-style-box' sx={avatarStyleBoxSx}>
        <Avatar component={'span'} id='active-avatar-wrapper' sx={avatarSx}>
          {initials(activePlayer.name)}
        </Avatar>
      </Box>
    </Box>
  );
}
const initials = function (name: string): string {
  const firstAndLast = name.split(' ');

  const [first, last] = firstAndLast;

  return last ? `${first[0]} ${last[0]}` : `${first[0]}${first[1]}`;
};
