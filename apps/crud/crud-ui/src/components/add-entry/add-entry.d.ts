import { album, artist, track } from '@prisma/client';
export type NewEntry = {
    artist: Partial<artist>;
    album: Partial<album>;
    track: Partial<track>;
};
export type NewEntryIDs = {
    artistID: number;
    albumID: number;
};
declare const AddEntry: () => import("react/jsx-runtime").JSX.Element;
export default AddEntry;
//# sourceMappingURL=add-entry.d.ts.map