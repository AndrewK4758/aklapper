import { FocusEvent } from 'react';
import { FormikProps } from 'formik';
import { album } from '@prisma/client';
declare const handleNewAlbumBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>, formik: FormikProps<album>, artistID: number) => Promise<any>;
export default handleNewAlbumBlur;
//# sourceMappingURL=handle-validate-artist-albums-on-blur.d.ts.map