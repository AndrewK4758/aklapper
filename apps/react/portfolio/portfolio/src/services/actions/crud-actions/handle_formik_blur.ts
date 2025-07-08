import type { FormikProps } from 'formik';
import type { FocusEvent } from 'react';
import getBlurResponse from './get_blur_response';

const handleFormikBlur = async <T>(
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

    const blurResp = await getBlurResponse(params);

    if (blurResp.status === 'error') {
      handleExists<T>(field, blurResp.message, formik);
    } else if (blurResp.status === 'availavle') {
      formik.setFieldTouched(field, true, true);
      handleUpdateHelperText(blurResp.message);
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
