import { type SxProps } from '@mui/material/styles';
import type { Variant } from '@mui/material/styles/createTypography';
import { type JSX, type ReactNode } from 'react';
export interface LabelProps {
    tooltipTitle: ReactNode;
    labelVariant: Variant;
    labelText: string;
    labelTextsx?: SxProps;
    tooltipSx?: SxProps;
    placement: 'bottom' | 'left' | 'right' | 'top' | 'bottom-end' | 'bottom-start' | 'left-end' | 'left-start' | 'right-end' | 'right-start' | 'top-end' | 'top-start' | undefined;
    Icon?: JSX.Element | undefined;
    children?: ReactNode | ReactNode[];
}
export declare const Label: import("react").ForwardRefExoticComponent<LabelProps & import("react").RefAttributes<HTMLDivElement>>;
export default Label;
//# sourceMappingURL=label.d.ts.map