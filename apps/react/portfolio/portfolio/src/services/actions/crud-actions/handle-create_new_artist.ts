import type { artist } from '@aklapper/chinook-client';
import { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { FetcherSubmitFunction } from 'react-router';
import type { ArtistSubmitAction } from '../../../types/types.js';

const handleSubmitNewArtist = async (values: artist, formik: FormikProps<artist>, submit: FetcherSubmitFunction) => {
  const { name } = values;
  try {
    const newArtistdata: ArtistSubmitAction = { artist: { name }, intent: 'create' };
    await submit(newArtistdata, { action: '/portfolio/crud/artists', method: 'POST', encType: 'application/json' });
  } catch (error) {
    console.error(error);
    const errorMessage = ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ name: errorMessage });
  } finally {
    formik.setSubmitting(false);
    formik.resetForm();
  }
};

export default handleSubmitNewArtist;
