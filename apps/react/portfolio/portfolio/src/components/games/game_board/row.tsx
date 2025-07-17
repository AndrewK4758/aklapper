import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import Space from './space';

export interface GameBoardProps {
  row: ILiteSpace[];
  id: string | undefined;
}

const Row = function ({ row, id }: GameBoardProps) {
  return (
    <Box id={id} className={css({ display: 'flex' })}>
      {row.map(space => (
        <Space key={space.display} space={space} />
      ))}
    </Box>
  );
};

export default Row;
