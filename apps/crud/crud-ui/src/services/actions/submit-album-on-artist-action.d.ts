import { GridApiCommunity } from '@mui/x-data-grid/internals';
import { album } from '@prisma/client';
import { FormikProps } from 'formik';
import { RefObject } from 'react';
declare const handleSubmitNewAlbum: (values: album, formik: FormikProps<album>, artistID: number, apiRef: RefObject<GridApiCommunity>) => Promise<void>;
export default handleSubmitNewAlbum;
//# sourceMappingURL=submit-album-on-artist-action.d.ts.map