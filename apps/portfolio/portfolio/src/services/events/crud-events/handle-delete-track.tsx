import { GridApiCommunity } from '@mui/x-data-grid/internals';
import { track } from '@prisma/client-generated';
import axios from 'axios';
import { RefObject } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleDeleteTrack = async (values: track, apiRef: RefObject<GridApiCommunity>) => {
  try {
    const { track_id } = values;

    const resp = await axios.delete(`${baseURL}/tracks/${track_id}`, {
      headers: { 'Content-Type': 'text/plain' }
    });

    console.log(resp.data);
    if (resp.data.deletedTrack && apiRef.current) {
      const { track_id } = resp.data.deletedTrack;
      apiRef.current.updateRows([{ track_id: track_id, _action: 'delete' }]);
    }
  } catch (error) {
    console.error(error);
  }
};

export default handleDeleteTrack;
