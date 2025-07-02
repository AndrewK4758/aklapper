import type { ReactElement } from 'react';

export interface RenderListProps<T> {
  data: T[];
  listMapCallback(e: T, i: number, arr: T[]): ReactElement<T>;
}

export const RenderList = <T,>({ data, listMapCallback }: RenderListProps<T>): ReactElement<T> => (
  <>{data.map(listMapCallback)}</>
);

export default RenderList;
