import type { album } from '@aklapper/chinook-client';
import { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { FetcherSubmitFunction } from 'react-router';
import type { AlbumSubmitAction } from '../../../types/types';

export default async function handleSubmitAlbumOnArtist(
  values: album,
  formik: FormikProps<album>,
  submit: FetcherSubmitFunction,
) {
  try {
    const data: AlbumSubmitAction = { album: values, intent: 'create' };

    await submit(data, {
      method: 'POST',
      encType: 'application/json',
      action: '/portfolio/crud/artists/:artistID/albums',
    });
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ title: errorMessage });
  } finally {
    formik.setSubmitting(false);
  }
}
