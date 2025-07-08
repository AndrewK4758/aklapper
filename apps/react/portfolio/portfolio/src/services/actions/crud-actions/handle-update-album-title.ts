import type { album } from '@aklapper/chinook-client';
import type { FetcherSubmitFunction } from 'react-router';
import type { AlbumSubmitAction } from '../../../types/types.js';

const handleUpdateAlbumTitle = async (values: album, submit: FetcherSubmitFunction) => {
  try {
    const { album_id, title } = values;

    const data: AlbumSubmitAction = { album: { album_id, title }, intent: 'update' };

    await submit(data, {
      method: 'PATCH',
      encType: 'application/json',
      action: 'portfolio/crud/artists/:artistID/albums',
    });
  } catch (error) {
    console.error(error);
  }
};

export default handleUpdateAlbumTitle;
