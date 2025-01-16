import type { SxProps } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { Variant } from '@mui/material/styles/createTypography';
import { type LabelProps } from '../label/label';
interface TechListProps extends LabelProps {
    techListContainerSxProps: SxProps;
    techListTextSxProps: SxProps;
    data: string[];
    renderTechLists: (value: unknown, index: number, array: unknown[]) => ReactNode;
    id: string;
    labelText: string;
    variant: Variant;
}
export declare const TechList: ({ techListContainerSxProps, techListTextSxProps, data, renderTechLists, id, labelText, variant, tooltipTitle, placement }: TechListProps) => import("react/jsx-runtime").JSX.Element;
export default TechList;
//# sourceMappingURL=tech-list.d.ts.map