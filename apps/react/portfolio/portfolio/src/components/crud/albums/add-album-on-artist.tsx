import type { album } from '@aklapper/chinook-client';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Form, useParams } from 'react-router';
import handleSubmitAlbumOnArtist from '../../../services/actions/crud-actions/submit-album-on-artist-action.jsx';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import TextInput from '../../text_input/text_input.js';

interface AddAlbumOnArtistProps {
  setRows: Dispatch<SetStateAction<album[] | null>>;
}

/**
 * This component renders a form for adding a new album to a specific artist.
 * It allows users to input the album title and then submits the data to the server.
 *
 * @returns {ReactElement} The rendered AddAlbumOnArtist component.
 */

const AddAlbumOnArtist = ({ setRows }: AddAlbumOnArtistProps): ReactElement => {
  const { artistID } = useParams() as { artistID: string };
  const formik = useFormik({
    initialValues: { title: '', album_id: 0, artist_id: 0 },
    onSubmit: async values => {
      await handleSubmitAlbumOnArtist(values.title, formik, parseInt(artistID, 10), setRows);
    },
    validateOnBlur: true,
  });

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv id='add-albums-on-artist-container'>
        <TextInput<album>
          formik={formik}
          name={'title'}
          label={'Album Title'}
          variant='outlined'
          searchParams={`/albums/${formik.values.title}`}
          slotProps={{
            input: {
              sx: {
                backgroundColor: BACKGROUND_DEFAULT,
              },
            },
          }}
        />

        <ButtonGroup fullWidth>
          <Button
            type='submit'
            disabled={formik.isSubmitting}
            variant='contained'
            color='primary'
            sx={{ fontWeight: 'bold' }}
          >
            {formik.isSubmitting ? 'Submitting' : 'Submit'}
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={{ fontWeight: 'bold' }}>
            Clear
          </Button>
        </ButtonGroup>
      </CenteredFlexDiv>
    </Form>
  );
};

export default AddAlbumOnArtist;
