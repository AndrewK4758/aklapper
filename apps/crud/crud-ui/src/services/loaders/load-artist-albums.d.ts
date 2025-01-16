import { album } from '@prisma/client';
import { LoaderFunction } from 'react-router-dom';
export type ArtistAlbums = {
    albums: album[];
};
declare const loadArtistAlbums: LoaderFunction;
export default loadArtistAlbums;
//# sourceMappingURL=load-artist-albums.d.ts.map