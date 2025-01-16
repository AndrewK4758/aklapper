import { SxProps } from '@mui/material';
import { Variant } from '@mui/material/styles/createTypography';
import { ReactNode, type ElementType } from 'react';
export interface TextProps {
    titleVariant: Variant;
    id?: string;
    titleText: ReactNode;
    sx?: SxProps;
    component: ElementType;
}
export declare const Text: ({ component, id, titleVariant, titleText, sx }: TextProps) => import("react/jsx-runtime").JSX.Element;
export default Text;
//# sourceMappingURL=text.d.ts.map