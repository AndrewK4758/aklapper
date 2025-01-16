import { track } from '@prisma/client';
import { LoaderFunction } from 'react-router-dom';
export type AlbumTracks = {
    tracks: track[];
};
declare const loadAlbumTracks: LoaderFunction;
export default loadAlbumTracks;
//# sourceMappingURL=load-album-tracks.d.ts.map