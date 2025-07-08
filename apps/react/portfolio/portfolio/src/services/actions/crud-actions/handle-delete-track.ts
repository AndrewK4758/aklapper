import type { track } from '@aklapper/chinook-client';
import type { FetcherSubmitFunction } from 'react-router';
import type { TrackSubmitAction } from '../../../types/types.js';

const handleDeleteTrack = async (values: track, submit: FetcherSubmitFunction) => {
  try {
    const data: TrackSubmitAction = {
      intent: 'delete',
      track: { ...values, unit_price: values.unit_price.toString() },
    };

    await submit(data, {
      method: 'DELETE',
      encType: 'application/json',
      action: '/portfolio/crud/artists/:artistID/albums/:albumID/tracks',
    });
  } catch (error) {
    console.error(error);
  }
};

export default handleDeleteTrack;
