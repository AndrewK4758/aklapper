import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { Dispatch, SetStateAction } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleDeleteTrack = async (values: track, setRows: Dispatch<SetStateAction<track[] | null>>) => {
  try {
    const { track_id } = values;

    const resp = await axios.delete(`${baseURL}/tracks/${track_id}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const { message, value } = resp.data as CRUD_ApiResponse<track>;
    console.log(message);

    if (value) setRows(prev => prev && prev.filter(track => track.track_id !== value.track_id));
  } catch (error) {
    console.error(error);
  }
};

export default handleDeleteTrack;
