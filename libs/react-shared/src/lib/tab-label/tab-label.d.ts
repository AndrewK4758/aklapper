import type { SxProps } from '@mui/material/styles';
import type { Variant } from '@mui/material/styles/createTypography';
export interface TabLabelProps {
    mainVariant: Variant;
    subVariant: Variant;
    mainText: string;
    subText: string;
    mainSx?: SxProps;
    subSx?: SxProps;
    id?: string;
}
export declare const TabLabel: ({ id, mainVariant, mainText, mainSx, subVariant, subText, subSx }: TabLabelProps) => import("react/jsx-runtime").JSX.Element;
export default TabLabel;
//# sourceMappingURL=tab-label.d.ts.map