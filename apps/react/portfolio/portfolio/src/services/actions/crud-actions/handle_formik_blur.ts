import axios from 'axios';
import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleFormikBlur = async <T,>(
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  formik: FormikProps<T>,
  handleUpdateHelperText: (inDbRessponse: string) => void,
  params: string,
) => {
  try {
    const name = e.target.value;
    const field = e.target.name;

    if (!name.length) {
      await formik.setFieldTouched(field, true, true);
      return;
    }

    formik.setSubmitting(true);

    const resp = await axios.get(`${baseURL}/${params}`);

    const dbMessage = resp.data.message;

    console.log(dbMessage);

    if (dbMessage === 'Artist Already Exists') {
      handleExists<T>(field, dbMessage, formik);
    } else {
      formik.setFieldTouched(field, true, true);
      handleUpdateHelperText(resp.data.message);
    }
  } catch (error) {
    console.error(error);
  } finally {
    formik.setSubmitting(false);
  }
};

export default handleFormikBlur;

async function handleExists<T>(field: string, dbMessage: string, formik: FormikProps<T>) {
  await formik.setFieldTouched(field, true, true);
  formik.setFieldError(field, dbMessage);
}
