import { Text } from '@aklapper/react-shared';
import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Theme from '../../../styles/themes/theme';

interface SpaceProps {
  space: ILiteSpace;
}

export default function Space({ space }: SpaceProps) {
  return (
    <Box
      key={space.display}
      sx={{
        display: 'flex',
        backgroundColor: Theme.palette.background.paper,
        border: `1px solid ${Theme.palette.primary.main}`,
        borderRadius: '16px',
        flex: 1,
        minHeight: '90px',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {space.display.endsWith('.svg') ? (
        <img
          key={`${space.display}-avatar-c&l`}
          id={`${space.display}-avatar-c&l`}
          data-testid={`${space.display}-avatar-c&l`}
          src={`/game-avatars/${space.display}`}
          alt={`${space.display} game piece`}
          style={{ alignSelf: 'self-start', width: '55%', height: 'auto' }}
        />
      ) : (
        <Text
          key={`${space.display}-space-text-c&l`}
          id={`${space.display}-space-text-c&l`}
          data-testid={`${space.display}-space-text-c&l`}
          variant='body2'
          children={space.display}
        />
      )}
    </Box>
  );
}

// export default memo(Space);
