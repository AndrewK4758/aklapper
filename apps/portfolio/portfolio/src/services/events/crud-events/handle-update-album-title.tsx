import { GridApiCommunity } from '@mui/x-data-grid/internals';
import { album } from '@prisma/client';
import axios from 'axios';
import { RefObject } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleUpdateAlbumTitle = async (values: album, apiRef: RefObject<GridApiCommunity>) => {
  try {
    const { album_id, title } = values;
    const resp = await axios.patch(
      `${baseURL}/albums`,
      { albumID: album_id, title: title },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (resp.data.updatedAlbum && apiRef.current) {
      const { album_id, title } = resp.data.updatedAlbum;
      apiRef.current.updateRows([{ album_id: album_id, title: title }]);
    }
  } catch (error) {
    console.error(error);
  }
};

export default handleUpdateAlbumTitle;
