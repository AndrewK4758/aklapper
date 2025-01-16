import type { SxProps } from '@mui/material/styles';
import type { ReactNode } from 'react';
export interface RenderListProps {
    data: unknown[];
    listMapCallback(e: unknown, i: number, arr: unknown[]): ReactNode;
    sx?: SxProps;
    id?: string;
}
export declare const RenderList: ({ id, data, listMapCallback, sx }: RenderListProps) => import("react/jsx-runtime").JSX.Element;
export default RenderList;
//# sourceMappingURL=render-list.d.ts.map