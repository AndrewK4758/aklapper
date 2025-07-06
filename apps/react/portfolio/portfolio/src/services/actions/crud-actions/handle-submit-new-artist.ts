import type { artist } from '@aklapper/chinook-client';
import { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
// import type { Dispatch, SetStateAction } from 'react';
// import type { CRUD_ApiResponse } from '../../../types/types.js';
import type { FetcherSubmitFunction } from 'react-router';
// import type { FetcherSubmitFunction } from 'react-router';

const handleSubmitNewArtist = async (values: artist, formik: FormikProps<artist>, submit: FetcherSubmitFunction) => {
  const { name } = values;
  try {
    const newArtistdata = { name, intent: 'create' };
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
