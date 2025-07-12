import { Text } from '@aklapper/react-shared';
import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import Theme from '../../../styles/themes/theme';

interface SpaceProps {
  space: ILiteSpace;
}

export default function Space({ space }: SpaceProps) {
  return (
    <Box
      className={css({
        display: 'flex',
        backgroundColor: Theme.palette.background.paper,
        border: `1px solid ${Theme.palette.primary.main}`,
        borderRadius: '16px',
        flex: 1,
        minHeight: '92px',
        justifyContent: 'center',
        alignItems: 'center',
      })}
    >
      {space.display.endsWith('.svg') ? (
        <img
          id={`${space.display}-avatar-c&l`}
          data-testid={`${space.display}-avatar-c&l`}
          src={`/game-avatars/${space.display}`}
          alt={`${space.display} game piece`}
          style={{ alignSelf: 'center', width: '55%', height: 'auto' }}
        />
      ) : (
        <Text
          id={`${space.display}-space-text-c&l`}
          data-testid={`${space.display}-space-text-c&l`}
          variant='body2'
          children={space.display}
        />
      )}
    </Box>
  );
}
