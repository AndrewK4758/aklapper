import type { album } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios from 'axios';
import { type FormikProps, useFormik } from 'formik';
import type { ChangeEvent, RefObject } from 'react';
import { Form } from 'react-router';
import handleSubmitNewAlbum from '../../services/actions/submit-album-to-artist-id-action';

const baseURL = import.meta.env.VITE_DATA_API_URL;

interface AddAlbumProps {
  apiRef: RefObject<GridApiCommunity | null>;
}

const AddAlbum = ({ apiRef }: AddAlbumProps) => {
  const formik = useFormik({
    initialValues: { title: '', album_id: 0, artist_id: 0 },
    onSubmit: values => {
      handleSubmitNewAlbum(values, formik, apiRef);
    },
    validateOnBlur: true,
  });

  formik.handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.type === 'text') {
      const title = e.target.value;
      formik.values.title = title;
    }
    if (e.target.type === 'number') {
      const artistID = e.target.value;
      formik.values.artist_id = parseInt(artistID, 10);
    }
  };

  formik.handleBlur = () => {
    handleNewAlbumBlur(formik);
  };

  return (
    <Container>
      <Form method='post' onSubmit={formik.handleSubmit}>
        <Box component={'div'}>
          <Box
            key={'add-album-input-divs-box'}
            component={'div'}
            onBlur={formik.handleBlur}
            sx={{ display: 'flex', flexDirection: 'column' }}
          >
            <FormLabel htmlFor='name'>Album Name</FormLabel>
            <TextField
              autoComplete='off'
              name='name'
              id='name'
              variant='outlined'
              color='primary'
              placeholder='Enter Album Name'
              onChange={e => formik.handleChange(e)}
            />
            <FormLabel htmlFor='artist_id'>Artist ID</FormLabel>
            <TextField
              type='number'
              autoComplete='off'
              name='artist_id'
              id='artist_id'
              variant='outlined'
              color='primary'
              placeholder='Enter Artist ID'
              onChange={e => formik.handleChange(e)}
            />
            <>
              {typeof formik.touched.title === 'string' && formik.touched.artist_id ? (
                <Text variant='body1' children={formik.touched.title} />
              ) : null}
              {typeof formik.errors.title === 'string' && formik.touched.title === true ? (
                <Text variant='body1' children={formik.errors.title} />
              ) : null}
            </>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyItems: 'center' }}>
          <Button type='submit' variant='contained' color='primary' sx={{ m: 1, flex: '1 0 30%' }}>
            Submit
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={{ m: 1, flex: '1 0 30%' }}>
            Clear
          </Button>
        </Box>
      </Form>
    </Container>
  );
};

const handleNewAlbumBlur = async (formik: FormikProps<album>) => {
  try {
    const { title, artist_id } = formik.values;
    const resp = await axios.get(`${baseURL}/albums?title=${title}&artistID=${artist_id}`, {
      headers: { 'Content-Type': 'text/plain' },
    });
    console.log(resp.data.message);
    formik.setTouched({ title: resp.data.message, artist_id: true }, true);
    return resp.data.message;
  } catch (error) {
    formik.setErrors({ title: (error as Error).message });
    console.error(error);
  }
};

export default AddAlbum;
