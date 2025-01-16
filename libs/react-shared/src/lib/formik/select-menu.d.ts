import { AvatarTotem } from '@aklapper/types-game';
import { SxProps } from '@mui/material';
import type { JSX } from 'react';
import type { Theme } from '@mui/material/styles';
interface IAvatarColorSelectValues {
    name: string;
    label: string;
    id?: string;
    data: string[] | AvatarTotem[];
    mapCallback(v: unknown, i: number, arr: unknown[]): JSX.Element;
    labelSx?: SxProps;
    selectSx: SxProps;
    Theme: Theme;
}
export declare function SelectMenu({ label, mapCallback, labelSx, selectSx, data, Theme, ...props }: IAvatarColorSelectValues): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=select-menu.d.ts.map