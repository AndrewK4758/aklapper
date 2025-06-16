import Stack from '@mui/material/Stack';
import dayjs, { type Dayjs } from 'dayjs';
import { useFormik } from 'formik';
import { useContext, useRef } from 'react';
import { Form, useSubmit, type SubmitFunction } from 'react-router';
import * as Yup from 'yup';
import 'yup-phone-lite';
import { GoogleUserContext, type GoogleUserContextProps } from '../../../contexts/contact-context';
import { clientCheck } from '../../../utils/utils';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import DateTimeInput from './date_time_input.js';
import EmailFormActions from './email-form-actions';
import TextInput from './text_input';
import UploadFileButton from './upload_file_button';

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

interface EmaiFormProps {
  setOpen: () => void;
}

const EmaiForm = ({ setOpen }: EmaiFormProps) => {
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();

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
    onSubmit: values => handleSubmitMessage(values, submit, setOpen),
  });

  return (
    <CenteredFlexDiv component={'section'} id='email-form-wrapper' data-testid='email-form-wrapper' p={4}>
      <Form
        id='email-me-form'
        className='contact-form'
        data-testid='email-me-form'
        encType='multipart/form-data'
        onSubmit={formik.handleSubmit}
        onReset={formik.handleReset}
      >
        <Stack id='email-me-inputs-stack' data-testid='email-me-inputs-stack'>
          <TextInput<MessageMeFormValues> name={'name'} label={'Name'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'email'} label={'Email'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'phone'} label={'Phone'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'subject'} label={'Subject'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'body'} label={'Body'} formik={formik} multiline={true} />

          <DateTimeInput formik={formik} name={'date'} />

          <UploadFileButton fileInputRef={fileInputRef} formik={formik} name={'attachment'} />

          <EmailFormActions formik={formik} handleFileSubmit={handleFileSubmit} />
        </Stack>
      </Form>
    </CenteredFlexDiv>
  );
};

export default EmaiForm;

//TODO - move to services or actions directory

const handleSubmitMessage = async (
  values: MessageMeFormValues,
  submit: SubmitFunction,
  setOpen: (open: boolean) => void,
) => {
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

    await submit(form, { method: 'post', encType: 'multipart/form-data' });
  } catch (error) {
    console.error(error);
    if (clientCheck()) alert('Error submitting event, Please submit again.');
  } finally {
    setOpen(false);
  }
};
