import type { album } from '@aklapper/chinook-client';
import type { FetcherSubmitFunction } from 'react-router';

const handleDeleteAlbum = async (values: album, submit: FetcherSubmitFunction) => {
  try {
    const { album_id } = values;

    await submit(
      { album_id, intent: 'delete' },
      { method: 'DELETE', encType: 'application/json', action: '/portfolio/crud/artists/:artistID/albums' },
    );
  } catch (err) {
    console.error(err);
  }
};

export default handleDeleteAlbum;
