import { NewEntry } from '../../components/add-entry/add-entry';
import { track } from '@prisma/client';
export type NewEntryReturn = {
    artist_id: number;
    name: string;
    album: {
        album_id: number;
        artist_id: number;
        title: string;
        track: track[];
    }[];
};
declare const handleSubmitNewEntry: (values: NewEntry, setSubmitting: (isSubmitting: boolean) => void) => Promise<NewEntryReturn | null>;
export default handleSubmitNewEntry;
//# sourceMappingURL=submit.new-entry-action.d.ts.map