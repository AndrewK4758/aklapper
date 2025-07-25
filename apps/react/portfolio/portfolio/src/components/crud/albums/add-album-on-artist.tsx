import type { album } from '@aklapper/chinook-client';
import { CenteredFlexDiv, TextInput } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { css } from '@pigment-css/react';
import { useFormik } from 'formik';
import { type ReactElement } from 'react';
import { type FetcherWithComponents } from 'react-router';
import handleFormikBlur from '../../../services/actions/crud-actions/handle_formik_blur';
import handleSubmitAlbumOnArtist from '../../../services/actions/crud-actions/submit-album-on-artist-action';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';

interface AddAlbumOnArtistProps {
  fetcher: FetcherWithComponents<album>;
}

/**
 * This component renders a form for adding a new album to a specific artist.
 * It allows users to input the album title and then submits the data to the server.
 *
 * @returns {ReactElement} The rendered AddAlbumOnArtist component.
 */

const AddAlbumOnArtist = ({ fetcher }: AddAlbumOnArtistProps): ReactElement => {
  const formik = useFormik({
    initialValues: { title: '', album_id: 0, artist_id: 0 },
    onSubmit: async values => {
      await handleSubmitAlbumOnArtist(values, formik, fetcher.submit);
    },
  });

  return (
    <fetcher.Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv id='add-albums-on-artist-container'>
        <TextInput<album>
          formik={formik}
          name={'title'}
          label={'Album Title'}
          variant='outlined'
          searchParams={`/albums/${formik.values.title}`}
          handleBlur={handleFormikBlur}
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
            className={css({ fontWeight: 'bold' })}
          >
            {formik.isSubmitting ? 'Submitting' : 'Submit'}
          </Button>
          <Button type='reset' variant='contained' color='secondary' className={css({ fontWeight: 'bold' })}>
            Clear
          </Button>
        </ButtonGroup>
      </CenteredFlexDiv>
    </fetcher.Form>
  );
};

export default AddAlbumOnArtist;
