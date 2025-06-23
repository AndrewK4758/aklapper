import type { artist } from '@aklapper/chinook-client';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { Dispatch, SetStateAction } from 'react';
import type { CRUD_ApiResponse } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleSubmitNewArtist = async (
  values: artist,
  formik: FormikProps<artist>,
  setRows: Dispatch<SetStateAction<artist[] | null>>,
) => {
  const { name } = values;
  try {
    const resp = await axios.post(
      `${baseURL}/artists`,
      { name: name },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const { value } = resp.data as CRUD_ApiResponse<artist>;

    setRows(prev => prev && [...prev, value]);
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
