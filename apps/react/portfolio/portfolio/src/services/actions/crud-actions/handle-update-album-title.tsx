import type { album } from '@aklapper/chinook-client';
import type { FetcherWithComponents } from 'react-router';

const handleUpdateAlbumTitle = async (values: album, fetcher: FetcherWithComponents<album>) => {
  try {
    const { album_id, title } = values;

    await fetcher.submit(
      { album_id, title, intent: 'update' },
      { method: 'PATCH', encType: 'application/json', action: 'portfolio/crud/artists/:artistID/albums' },
    );
  } catch (error) {
    console.error(error);
  }
};

export default handleUpdateAlbumTitle;
