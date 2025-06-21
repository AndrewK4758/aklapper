import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { Dispatch, SetStateAction } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleUpdateTrack = async (values: track, setRows: Dispatch<SetStateAction<track[] | null>>) => {
  try {
    const { track_id, album_id, name, unit_price, genre_id, media_type_id, composer, milliseconds, bytes } = values;

    const trackData = {
      track_id: track_id,
      album_id: album_id,
      name: name,
      unit_price: unit_price,
      genre_id: genre_id,
      media_type_id: media_type_id,
      composer: composer,
      milliseconds: milliseconds,
      bytes: bytes,
    };

    const resp = await axios.patch(
      `${baseURL}/tracks`,
      { trackData: trackData },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const { message, value } = resp.data as CRUD_ApiResponse<track>;

    console.log(message);

    setRows(prev => prev && prev.map(track => (track.track_id === value.track_id ? value : track)));
  } catch (error) {
    console.error(error);
  }
};

export default handleUpdateTrack;
