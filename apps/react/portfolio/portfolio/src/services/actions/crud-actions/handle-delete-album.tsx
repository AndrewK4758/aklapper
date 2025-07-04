import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { Dispatch, SetStateAction } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleDeleteAlbum = async (values: album, setRows: Dispatch<SetStateAction<album[] | null>>) => {
  try {
    const { album_id } = values;

    const resp = await axios.delete(`${baseURL}/albums/${album_id}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const { value } = resp.data as CRUD_ApiResponse<album>;

    setRows(prev => prev && prev.filter(album => album.album_id !== value.album_id));
  } catch (err) {
    console.error(err);
  }
};

export default handleDeleteAlbum;
