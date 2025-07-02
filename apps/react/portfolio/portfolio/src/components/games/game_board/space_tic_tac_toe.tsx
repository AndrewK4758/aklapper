import { Text } from '@aklapper/react-shared';
import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material/Box';
import type { SxProps } from '@mui/material/styles';
import type { MouseEvent } from 'react';
import Theme from '../../../styles/themes/theme';

interface SpaceTicTacToeProps {
  space: ILiteSpace;
  id: string;
  state: string | undefined;
  setStateAction: (space: string) => void;
}

export default function SpaceTicTacToe({ state, space, setStateAction, id }: SpaceTicTacToeProps) {
  return (
    <Box
      id={id}
      title={!space.display.endsWith('.svg') ? space.display : ''}
      sx={setStyleOnState(
        state,
        space.display,
        {
          flex: 1,
          backgroundColor: Theme.palette.background.paper,
          borderRadius: Theme.shape.borderRadius,
          border: `1px solid ${Theme.palette.primary.main}`,
          m: Theme.spacing(1),
          justifyContent: 'center',
          alignContent: 'center',

          '&:hover': {
            cursor: 'pointer',
          },
        },
        { backgroundColor: Theme.palette.primary.main, color: Theme.palette.primary.contrastText, fontWeight: 'bold' },
        {},
      )}
      onClick={(e: MouseEvent<HTMLDivElement>) => setStateAction(e.currentTarget.textContent as string)}
    >
      {space.display.endsWith('.svg') ? (
        <img
          src={`/game-avatars/${space.display}`}
          alt={`${space.display} game piece`}
          style={{ width: '150px', height: 'auto' }}
        />
      ) : (
        <Text
          id={`${space.display}-space`}
          data-testid={`${space.display}-space`}
          variant='body2'
          children={space.display}
        />
      )}
    </Box>
  );
}

const setStyleOnState = (
  state: string | undefined,
  name: string,
  base: SxProps,
  cond1: SxProps,
  cond2: SxProps,
): SxProps => (state === name ? ([base, cond1] as SxProps) : ([base, cond2] as SxProps));
