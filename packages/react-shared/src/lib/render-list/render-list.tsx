import Box from '@mui/material/Box';
import type { SxProps } from '@mui/material/styles';
import type { ReactNode } from 'react';

export interface RenderListProps {
  data: unknown[];
  listMapCallback(e: unknown, i: number, arr: unknown[]): ReactNode;
  sx?: SxProps;
  id?: string;
}

export const RenderList = ({ id, data, listMapCallback, sx }: RenderListProps) => (
  <Box key={id} id={id} sx={sx}>
    {data.map(listMapCallback)}
  </Box>
);

export default RenderList;
