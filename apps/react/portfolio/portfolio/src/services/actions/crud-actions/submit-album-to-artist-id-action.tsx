import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { RefObject } from 'react';
import type { album } from '../../../types/prisma_types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleSubmitNewAlbum = async (
  values: album,
  formik: FormikProps<album>,
  apiRef: RefObject<GridApiCommunity | null>,
) => {
  try {
    const albumTitle = values.title;
    const artistID = values.artist_id;

    const resp = await axios.post(
      `${baseURL}/albums`,
      { title: albumTitle, artistID: artistID },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (resp.data.newAlbum && apiRef.current) {
      const { title, album_id, artist_id } = resp.data.newAlbum;
      apiRef.current.updateRows([{ album_id: album_id, title: title, artist_id: artist_id }]);
    }
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ title: errorMessage });
  }
};

export default handleSubmitNewAlbum;
