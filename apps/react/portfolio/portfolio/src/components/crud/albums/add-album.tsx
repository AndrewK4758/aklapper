import { FormikValidationError } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios from 'axios';
import { type FormikProps, useFormik } from 'formik';
import type { JSX, RefObject } from 'react';
import { Form } from 'react-router';
import * as Yup from 'yup';
import handleSubmitNewAlbum from '../../../services/actions/crud-actions//submit-album-to-artist-id-action.jsx';
import { crudAddButtonStyles, crudAddErrorTextStyles } from '../../../styles/crud-styles.jsx';
import { flexColumnStyles } from '../../../styles/pages-styles.jsx';
import type { album } from '../../../types/prisma_types.js';
import type { ArtistAndAlbum } from './add-album-on-artist.jsx';

interface AddAlbumProps {
  apiRef: RefObject<GridApiCommunity | null>;
}

const validationSchema = Yup.object<album>({
  title: Yup.string().required('Must have title to album'),
  artist_id: Yup.number().positive('Must be greater than 0').required('Need artist ID to add the album on'),
});

/**
 * This component renders a form for adding a new album to a selected artist.
 * It allows users to input the album title and then submits the data to the server.
 *
 * @param {AddAlbumOnArtistProps} props - The props for the AddAlbumOnArtist component.
 * @param {RefObject<GridApiCommunity>} props.apiRef - A ref to the DataGrid API object.
 * @returns {JSX.Element} The rendered AddAlbum component.
 */

const AddAlbum = ({ apiRef }: AddAlbumProps): JSX.Element => {
  const formik = useFormik<album>({
    initialValues: { title: '', album_id: 0, artist_id: 1 },
    validationSchema: validationSchema,
    onSubmit: values => {
      handleSubmitNewAlbum(values, formik, apiRef);
    },
    validateOnBlur: true,
  });

  formik.handleBlur = () => {
    handleNewAlbumBlur(formik);
  };

  return (
    <Container
      component={'div'}
      id='add-album-container'
      key={'add-album-container'}
      sx={{ borderRadius: 1, paddingY: 2 }}
    >
      <Form method='post' onSubmit={formik.handleSubmit}>
        <Box component={'div'} sx={flexColumnStyles}>
          <Box key={'add-album-input-divs-box'} component={'div'} onBlur={formik.handleBlur} sx={flexColumnStyles}>
            <FormLabel htmlFor='title'>Album Name</FormLabel>
            <TextField
              autoComplete='off'
              name='title'
              id='title'
              variant='outlined'
              color='primary'
              value={formik.values.title}
              placeholder='Enter Album Name'
              onChange={e => formik.setFieldValue('title', e.target.value)}
            />
            <FormikValidationError<ArtistAndAlbum>
              formik={formik}
              elementName={'title'}
              helperTextSx={crudAddErrorTextStyles}
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
              value={formik.values.artist_id}
              onChange={e => formik.setFieldValue('artist_id', e.target.value)}
            />

            <FormikValidationError<ArtistAndAlbum>
              formik={formik}
              elementName={'artist_id'}
              helperTextSx={crudAddErrorTextStyles}
            />
          </Box>
        </Box>

        <Box display={'flex'} justifyItems={'center'}>
          <Button type='submit' variant='contained' color='primary' sx={crudAddButtonStyles}>
            Submit
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={crudAddButtonStyles}>
            Clear
          </Button>
        </Box>
      </Form>
    </Container>
  );
};

export default AddAlbum;

const baseURL = import.meta.env.VITE_DATA_API_URL;

const handleNewAlbumBlur = async (formik: FormikProps<ArtistAndAlbum>) => {
  try {
    const { title, artist_id } = formik.values;
    const resp = await axios.get(`${baseURL}/albums?title=${title}&artistID=${artist_id}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    formik.setTouched({ title: resp.data.message, artist_id: true }, true);
    return resp.data.message;
  } catch (error) {
    formik.setErrors({ title: (error as Error).message });
    console.error(error);
  }
};
