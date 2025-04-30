import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios from 'axios';
import type { RefObject } from 'react';
import type { album } from '../../../types/prisma_types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleDeleteAlbum = async (values: album, apiRef: RefObject<GridApiCommunity | null>) => {
  try {
    const { album_id } = values;

    const resp = await axios.delete(`${baseURL}/albums/${album_id}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    console.log(resp.data);
    if (resp.data.deletedAlbum && apiRef.current) {
      const { album_id } = resp.data.deletedAlbum;
      apiRef.current.updateRows([{ album_id: album_id, _action: 'delete' }]);
    }
  } catch (err) {
    console.error(err);
  }
};

export default handleDeleteAlbum;
