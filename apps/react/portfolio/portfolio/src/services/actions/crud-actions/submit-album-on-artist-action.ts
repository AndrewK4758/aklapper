import type { album } from '@aklapper/chinook-client';
import { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { FetcherSubmitFunction } from 'react-router';
import type { AlbumSubmitAction } from '../../../types/types.js';

export default async function handleSubmitAlbumOnArtist(
  values: album,
  formik: FormikProps<album>,
  fetcher: FetcherWithComponents<album>,
) {
  try {
    await fetcher.submit(
      { title, intent: 'create' },
      { method: 'POST', encType: 'application/json', action: '/portfolio/crud/artists/:artistID/albums' },
    );
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ title: errorMessage });
  } finally {
    formik.setSubmitting(false);
  }
}
