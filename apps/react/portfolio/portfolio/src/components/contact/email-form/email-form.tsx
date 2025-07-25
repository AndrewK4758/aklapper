import { CenteredFlexDiv, TextInput } from '@aklapper/react-shared';
import Stack from '@mui/material/Stack';
import { css } from '@pigment-css/react';
import dayjs, { type Dayjs } from 'dayjs';
import { useFormik } from 'formik';
import { useContext, useRef } from 'react';
import { Form } from 'react-router';
import * as Yup from 'yup';
import 'yup-phone-lite';
import { GoogleUserContext, type GoogleUserContextProps } from '../../../contexts/contact_context_constants';
import emailFormAction from '../../../services/actions/email-form-action';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';
import DateTimeInput from './date_time_input';
import EmailFormActions from './email-form-actions';
import UploadFileElement from './upload_file_element';

export type MessageMeFormValues = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  date: Dayjs;
  attachment: null;
};

const validationSchema = Yup.object({
  name: Yup.string().max(60, 'Name must be less than 60 characters').required('Please enter your name'),
  email: Yup.string().email().required('Please enter your email address'),
  phone: Yup.string().notRequired().phone('US', 'Please enter a valid US phone number'),
  subject: Yup.string().max(160, 'Must me less than 160 characters').required('Subject is required'),
  body: Yup.string().max(2000, 'Must be less than 2000 characters').required('Please enter your message'),
  attachment: Yup.mixed().notRequired(),
});

export interface EmailFormProps {
  setOpen: () => void;
}

export default function EmailForm({ setOpen }: EmailFormProps) {
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialValues = {
    name: GoogleUserContextValues.name ?? '',
    email: GoogleUserContextValues.email ?? '',
    phone: '',
    subject: 'I saw your website and wanted to reach out...',
    body: '',
    date: dayjs().add(1, 'day').set('hour', 8).set('minutes', 30),
    attachment: null,
  };

  const handleFileSubmit = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    validateOnChange: false,
    onSubmit: async values => await handleSubmitMessage(values, setOpen),
  });

  return (
    <CenteredFlexDiv id='email-form-wrapper' data-testid='email-form-wrapper' sx={{ padding: 4 }}>
      <Form
        id='email-me-form'
        className='contact-form'
        data-testid='email-me-form'
        encType='multipart/form-data'
        onSubmit={formik.handleSubmit}
        onReset={formik.handleReset}
      >
        <Stack id='email-me-inputs-stack' data-testid='email-me-inputs-stack' className={css({ gap: 2 })}>
          <TextInput<MessageMeFormValues>
            name={'name'}
            label={'Name'}
            formik={formik}
            variant='outlined'
            disabled={formik.isSubmitting}
            slotProps={{ input: { sx: { backgroundColor: BACKGROUND_DEFAULT } } }}
          />

          <TextInput<MessageMeFormValues>
            name={'email'}
            label={'Email'}
            formik={formik}
            variant='outlined'
            disabled={formik.isSubmitting}
            slotProps={{ input: { sx: { backgroundColor: BACKGROUND_DEFAULT } } }}
          />

          <TextInput<MessageMeFormValues>
            name={'phone'}
            label={'Phone'}
            formik={formik}
            variant='outlined'
            disabled={formik.isSubmitting}
            slotProps={{ input: { sx: { backgroundColor: BACKGROUND_DEFAULT } } }}
          />

          <TextInput<MessageMeFormValues>
            name={'subject'}
            label={'Subject'}
            formik={formik}
            variant='outlined'
            disabled={formik.isSubmitting}
            slotProps={{ input: { sx: { backgroundColor: BACKGROUND_DEFAULT } } }}
          />

          <TextInput<MessageMeFormValues>
            name={'body'}
            label={'Body'}
            formik={formik}
            multiline={true}
            variant='outlined'
            disabled={formik.isSubmitting}
            slotProps={{ input: { sx: { backgroundColor: BACKGROUND_DEFAULT } } }}
          />

          <DateTimeInput formik={formik} name={'date'} />

          <UploadFileElement fileInputRef={fileInputRef} formik={formik} name={'attachment'} />

          <EmailFormActions formik={formik} handleFileSubmit={handleFileSubmit} />
        </Stack>
      </Form>
    </CenteredFlexDiv>
  );
}

//TODO - move to services or actions directory

const handleSubmitMessage = async (values: MessageMeFormValues, setOpen: (open: boolean) => void) => {
  try {
    const { name, email, phone, subject, body, date, attachment } = values;

    const form = new FormData();

    form.append('name', name);
    form.append('email', email);
    form.append('phone', phone);
    form.append('subject', subject);
    form.append('body', body);
    form.append('date', date.format('MM-DD-YYYY/HH:mm'));
    if (attachment) form.append('attachment', attachment);

    await emailFormAction(form, setOpen);
  } catch (error) {
    console.error(error);
  } finally {
    setOpen(false);
  }
};
