import { createBrowserRouter, RouterProvider } from 'react-router';
import AddEntry from '../components/add-entry/add-entry';
import Album from '../components/albums/album-base';
import AlbumsOnArtist from '../components/albums/artist-albums';
import Artist from '../components/artists/artist-base';
import Tracks from '../components/tracks/album-tracks';
import Layout from '../pages/layout/layout';
import loadAlbumTracks from '../services/loaders/load-album-tracks';
import loadAlbumsCount from '../services/loaders/load-albums-count';
import loadArtistAlbums from '../services/loaders/load-artist-albums';
import loadArtistsCount from '../services/loaders/load-artists-count';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      {
        path: 'artists',
        id: 'artist-count',
        Component: Artist,
        loader: loadArtistsCount,
        children: [
          {
            path: ':artistID/album',
            id: 'artist-albums',
            Component: AlbumsOnArtist,
            loader: loadArtistAlbums,
            children: [
              {
                path: ':albumID/tracks',
                loader: loadAlbumTracks,
                Component: Tracks,
              },
            ],
          },
        ],
      },
      {
        path: 'albums',
        id: 'albums-count',
        Component: Album,
        loader: loadAlbumsCount,
        children: [
          {
            path: ':albumID/tracks',
            Component: Tracks,
            loader: loadAlbumTracks,
          },
        ],
      },
    ],
  },

  {
    index: true,
    path: 'add-entry',
    Component: AddEntry,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
