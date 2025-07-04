import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import { useFormik } from 'formik';
import type { FocusEvent, RefObject } from 'react';
import { Form, useParams } from 'react-router';
import handleSubmitNewAlbum from '../../services/actions/submit-album-on-artist-action';
import handleNewAlbumBlur from '../../services/events/handle-validate-artist-albums-on-blur';

interface AddAlbumOnArtistProps {
  apiRef: RefObject<GridApiCommunity | null>;
}

const AddAlbumOnArtist = ({ apiRef }: AddAlbumOnArtistProps) => {
  const params = useParams();
  const artistID = parseInt(params.artistID as string, 10);

  const formik = useFormik({
    initialValues: { title: '', album_id: 0, artist_id: 0 },
    onSubmit: values => {
      handleSubmitNewAlbum(values, formik, artistID, apiRef);
    },
    validateOnBlur: true,
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => {
    handleNewAlbumBlur(e, formik, artistID);
  };

  return (
    <Container component={'div'} id='add-album-on-artist-container' key={'add-album-on-artist-container'}>
      <Form method='post' onSubmit={formik.handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormLabel htmlFor='name' hidden>
            Enter Album Name
          </FormLabel>
          <TextField
            autoComplete='off'
            name='title'
            id='title'
            variant='outlined'
            color='primary'
            value={formik.values.title}
            placeholder='Enter Album Title'
            sx={{ flex: '1 0 50%' }}
            onChange={formik.handleChange}
            onBlur={e => formik.handleBlur(e)}
          />

          {typeof formik.touched.title === 'string' && formik.values.title ? (
            <Text variant='body1' children={formik.touched.title} />
          ) : null}
          {formik.errors.title && formik.touched.title === true ? (
            <Text variant='body1' children={formik.errors.title} />
          ) : null}
        </Box>

        <Container sx={{ display: 'flex', justifyItems: 'center' }}>
          <Button
            type='submit'
            variant='contained'
            color='primary'
            sx={{ marginTop: 1, marginRight: 1, flex: '1 0 30%' }}
          >
            Submit
          </Button>
          <Button
            type='reset'
            variant='contained'
            color='secondary'
            sx={{ marginTop: 1, marginLeft: 1, flex: '1 0 30%' }}
          >
            Clear
          </Button>
        </Container>
      </Form>
    </Container>
  );
};

export default AddAlbumOnArtist;
