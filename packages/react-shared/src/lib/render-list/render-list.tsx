import List from '@mui/material/List';
import type { SxProps } from '@mui/material/styles';
import type { ElementType, ReactNode } from 'react';

export interface RenderListProps {
  data: unknown[];
  listMapCallback(e: unknown, i: number, arr: unknown[]): ReactNode;
  sx?: SxProps;
  id?: string;
  component: ElementType;
}

export const RenderList = ({ id, data, component, listMapCallback, sx }: RenderListProps) => (
  <List key={id} component={component} id={id} sx={sx}>
    {data.map(listMapCallback)}
  </List>
);

export default RenderList;
