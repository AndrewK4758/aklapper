import type { album } from '@aklapper/chinook-client';

import axios from 'axios';
import type { Dispatch, SetStateAction } from 'react';
import type { CRUD_ApiResponse } from '../../../types/types.js';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleUpdateAlbumTitle = async (values: album, setRows: Dispatch<SetStateAction<album[] | null>>) => {
  try {
    const { album_id, title } = values;
    const resp = await axios.patch(
      `${baseURL}/albums`,
      { albumID: album_id, title: title },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { value, message } = resp.data as CRUD_ApiResponse<album>;

    console.log(message);

    setRows(prev => prev && prev.map(album => (album.album_id === album_id ? value : album)));
  } catch (error) {
    console.error(error);
  }
};

export default handleUpdateAlbumTitle;
