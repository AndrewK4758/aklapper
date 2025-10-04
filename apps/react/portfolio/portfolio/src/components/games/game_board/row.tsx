import type { ILiteSpace } from '@aklapper/types';
import Box from '@mui/material/Box';
import Space from './space';

export interface GameBoardProps {
  row: ILiteSpace[];
  id: string | undefined;
}

const Row = function ({ row, id }: GameBoardProps) {
  return (
    <Box id={id} sx={{ display: 'flex' }}>
      {row.map(space => (
        <Space key={space.display} space={space} />
      ))}
    </Box>
  );
};

export default Row;
