import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { Dispatch, SetStateAction } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

export default async function handleSubmitAlbumOnArtist(
  title: string,
  formik: FormikProps<album>,
  artistID: number,
  setRows: Dispatch<SetStateAction<album[] | null>>,
) {
  try {
    const resp = await axios.post(
      `${baseURL}/albums`,
      { title, artistID },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const { value } = resp.data as CRUD_ApiResponse<album>;

    setRows(prev => prev && prev.map(album => (album.artist_id === artistID ? value : album)));
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ title: errorMessage });
  } finally {
    formik.setSubmitting(false);
  }
}
