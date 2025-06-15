import { FormikValidationError } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import dayjs from 'dayjs';
import { useFormik } from 'formik';
import { useContext, useRef, type Dispatch, type SetStateAction } from 'react';
import { Form, useSubmit, type SubmitFunction } from 'react-router';
import * as Yup from 'yup';
import 'yup-phone-lite';
import { GoogleUserContext, type GoogleUserContextProps } from '../../../contexts/contact-context';
import { helperTextSx } from '../../../styles/gen-ai-styles';
import { emailButtonSxProps } from '../../../styles/header-styles';
import { flexColumnStyles } from '../../../styles/pages-styles';
import AnimatedBorderBox from '../../styled/animated_border_box';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import AppointmentMaker from '../appointment-maker/appointment-maker';
import TextInput from './text_input';

export type MessageMeFormValues = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  date: string;
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
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const EmaiForm = ({ setOpen }: EmaiFormProps) => {
  const submit = useSubmit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { GoogleUserContextValues } = useContext<GoogleUserContextProps>(GoogleUserContext);

  const initialValues = {
    name: GoogleUserContextValues.name ?? '',
    email: GoogleUserContextValues.email ?? '',
    phone: '',
    subject: 'I saw your website and wanted to reach out...',
    body: '',
    date: dayjs().add(1, 'day').format('MM-DD-YYYY/HH:mm'),
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
        method='post'
        encType='multipart/form-data'
        onSubmit={formik.handleSubmit}
      >
        <Stack id='email-me-inputs-stack' data-testid='email-me-inputs-stack'>
          <TextInput<MessageMeFormValues> name={'name'} label={'Name'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'email'} label={'Email'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'phone'} label={'Phone'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'subject'} label={'Subject'} formik={formik} />

          <TextInput<MessageMeFormValues> name={'body'} label={'Body'} formik={formik} multiline={true} />

          <Box
            component={'span'}
            key={'appointment-maker-wrapper'}
            id='appointment-maker-wrapper'
            data-testid='appointment-maker-wrapper'
          >
            <AppointmentMaker formik={formik} name={'date'} />
            <FormikValidationError<MessageMeFormValues>
              formik={formik}
              elementName='date'
              helperTextSx={helperTextSx}
            />
          </Box>
          <Box
            component={'span'}
            key={'attachment-wrapper'}
            id='attachment-wrapper'
            data-testid='attachment-wrapper'
            sx={flexColumnStyles}
          >
            <input
              ref={fileInputRef}
              accept='*/*'
              id='attchment'
              data-testid='attchment'
              name='attchment'
              type='file'
              style={{ display: 'none' }}
              onBlur={formik.handleBlur}
              onChange={async e => {
                if (e.target.files) await formik.setFieldValue('attachment', e.target.files[0], false);
              }}
            />
            {formik.values.attachment ? (
              <Box component={'span'} sx={{ fontSize: '1rem', alignSelf: 'center', textAlign: 'center' }}>
                {(formik.values.attachment as File).name}
              </Box>
            ) : null}
          </Box>

          <DialogActions>
            <Button
              id='upload-file-button'
              data-testid='upload-file-button'
              onClick={handleFileSubmit}
              sx={emailButtonSxProps}
            >
              Upload File
            </Button>
            <AnimatedBorderBox>
              <Button
                type='submit'
                id='submit-email-me-button'
                data-testid='submit-email-me-button'
                sx={emailButtonSxProps}
              >
                Submit
              </Button>
            </AnimatedBorderBox>
            <Button
              type='reset'
              id='reset-email-me-button'
              data-testid='reset-email-me-button'
              onReset={formik.handleReset}
              sx={emailButtonSxProps}
            >
              Reset
            </Button>
          </DialogActions>
        </Stack>
      </Form>
    </CenteredFlexDiv>
  );
};

export default EmaiForm;

const handleSubmitMessage = async (
  values: MessageMeFormValues,
  submit: SubmitFunction,
  setOpen: Dispatch<SetStateAction<boolean>>,
) => {
  try {
    const { name, email, phone, subject, body, date, attachment } = values;

    const form = new FormData();

    form.append('name', name);
    form.append('email', email);
    form.append('phone', phone);
    form.append('subject', subject);
    form.append('body', body);
    form.append('date', date);
    if (attachment) form.append('attachment', attachment);

    await submit(form, { action: '/', method: 'post', encType: 'multipart/form-data' });
  } catch (error) {
    console.error(error);
  } finally {
    setOpen(false);
  }
};
