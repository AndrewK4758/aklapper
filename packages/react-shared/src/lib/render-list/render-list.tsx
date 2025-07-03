import type { ReactNode } from 'react';

export interface RenderListProps<T> {
  data: T[];
  listMapCallback(e: T, i: number, arr: T[]): ReactNode;
}

export const RenderList = <T,>({ data, listMapCallback }: RenderListProps<T>): ReactNode => (
  <>{data.map(listMapCallback)}</>
);

export default RenderList;
