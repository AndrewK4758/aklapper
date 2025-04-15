import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type { FormikProps } from 'formik';
import type { artist } from '../../../types/prisma_types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleSubmitNewArtist = async (values: artist, formik: FormikProps<artist>) => {
  const { name } = values;
  try {
    const resp = await axios.post(
      `${baseURL}/artists`,
      { name: name },
      { headers: { 'Content-Type': 'application/json' } },
    );
    console.log(resp.data);
  } catch (error) {
    console.error(error);
    const errorMessage = ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ name: errorMessage });
  }
};

export default handleSubmitNewArtist;
