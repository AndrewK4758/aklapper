import axios from 'axios';
import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';

const baseURL = import.meta.env.VITE_DATA_API_URL;

const handleNewArtistBlur = async <T,>(
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  formik: FormikProps<T>,
) => {
  try {
    const name = e.target.value;
    const field = e.target.name;

    formik.setSubmitting(true);

    const resp = await axios.get(`${baseURL}/artists?name=${name}`);

    console.log(resp.config.baseURL);
    console.log(process.env.NODE_ENV);
    await formik.setFieldTouched(field, true, true);
    formik.setFieldError(field, resp.data.message);
  } catch (error) {
    console.error(error);
  } finally {
    formik.setSubmitting(false);
  }
};

export default handleNewArtistBlur;
