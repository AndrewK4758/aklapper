import type { album } from '@aklapper/chinook-client';
import { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { FetcherWithComponents } from 'react-router';

export default async function handleSubmitAlbumOnArtist(
  title: string,
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
