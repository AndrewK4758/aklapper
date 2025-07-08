import type { track } from '@aklapper/chinook-client';
import type { AxiosError, AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import { type FetcherSubmitFunction } from 'react-router';
import type { TrackSubmitAction } from '../../../types/types';

/**
 * This function handles the submission of the new track form.
 * It sends a POST request to the server with the track data and updates the DataGrid with the new track.
 *
 * @param {track} values - The track data from the form.
 * @param {FormikProps<track>} formik - The Formik props object.
 * @param {string} albumID - The ID of the album to add the track to.
 */

const handleSubmitNewTrack = async (values: track, formik: FormikProps<track>, submit: FetcherSubmitFunction) => {
  try {
    const { name, album_id } = values;

    const data: TrackSubmitAction = { intent: 'create', track: { name: name, album_id: album_id } };

    await submit(data, {
      method: 'POST',
      action: '/portfolio/crud/artists/:artistID/albums/:albumID/tracks',
      encType: 'application/json',
    });
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ name: errorMessage });
  } finally {
    formik.setSubmitting(false);
    formik.resetForm();
  }
};

export default handleSubmitNewTrack;
