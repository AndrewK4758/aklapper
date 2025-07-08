import type { track } from '@aklapper/chinook-client';
import type { FetcherSubmitFunction } from 'react-router';
import type { TrackSubmitAction } from '../../../types/types.js';

const handleUpdateTrack = async (values: track, submit: FetcherSubmitFunction) => {
  try {
    const data: TrackSubmitAction = {
      intent: 'update',
      track: { ...values, unit_price: values.unit_price.toString() },
    };

    await submit(data, {
      action: '/portfolio/crud/artists/:artistID/albums/:albumID/tracks',
      encType: 'application/json',
      method: 'PATCH',
    });
  } catch (error) {
    console.error(error);
  }
};

export default handleUpdateTrack;
