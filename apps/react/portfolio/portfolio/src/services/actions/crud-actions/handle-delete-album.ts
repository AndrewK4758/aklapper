import type { album } from '@aklapper/chinook-client';
import type { FetcherSubmitFunction } from 'react-router';
import type { AlbumSubmitAction } from '../../../types/types.js';

const handleDeleteAlbum = async (values: album, submit: FetcherSubmitFunction) => {
  try {
    const { album_id } = values;

    const data: AlbumSubmitAction = { album: { album_id }, intent: 'delete' };
    await submit(data, {
      method: 'DELETE',
      encType: 'application/json',
      action: '/portfolio/crud/artists/:artistID/albums',
    });
  } catch (err) {
    console.error(err);
  }
};

export default handleDeleteAlbum;
