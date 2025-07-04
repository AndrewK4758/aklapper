import { Text } from '@aklapper/react-shared';
import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material/Box';
import { memo, type ActionDispatch, type MouseEvent } from 'react';
import Theme from '../../../styles/themes/theme';
import type { IActiveGameInfo } from '../../../types/types';
import { Action } from './socket-reducer';

interface SpaceTicTacToeProps {
  space: ILiteSpace;
  id: string;
  state: IActiveGameInfo;
  dispatch: ActionDispatch<[action: Action]>;
}

const SpaceTicTacToe = memo(function ({ state, space, dispatch, id }: SpaceTicTacToeProps) {
  return (
    <Box
      id={id}
      title={!space.display.endsWith('.svg') ? space.display : ''}
      sx={[
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
        state.space === space.display && {
          backgroundColor: Theme.palette.primary.main,
          color: Theme.palette.primary.contrastText,
          fontWeight: 'bold',
        },
      ]}
      onClick={(e: MouseEvent<HTMLDivElement>) =>
        dispatch({ type: Action.SPACE, payload: { ...state, space: e.currentTarget.textContent as string } })
      }
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
});

export default SpaceTicTacToe;
