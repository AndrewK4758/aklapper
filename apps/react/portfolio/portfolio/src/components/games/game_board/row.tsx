import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import type { SxProp } from '@pigment-css/react';
import Space from './space.js';

const breakpointsBoardSxProp: SxProp = { display: 'flex' };

export interface GameBoardProps {
  row: ILiteSpace[];
  id: string | undefined;
}

export const Row = ({ row, id }: GameBoardProps) => (
  <Box id={id} sx={breakpointsBoardSxProp}>
    {row.map(space => (
      <Space key={space.display} space={space} />
    ))}
  </Box>
);

export default Row;
