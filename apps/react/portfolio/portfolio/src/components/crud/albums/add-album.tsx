import type { album } from '@aklapper/chinook-client';
import { CenteredFlexDiv, TextInput } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { type ReactElement } from 'react';
import { type FetcherWithComponents } from 'react-router';
import * as Yup from 'yup';
import handleFormikBlur from '../../../services/actions/crud-actions/handle_formik_blur';
import handleSubmitAlbumOnArtist from '../../../services/actions/crud-actions/submit-album-on-artist-action';
import Theme from '../../../styles/themes/theme';

const validationSchema = Yup.object<album>({
  title: Yup.string().required('Must have title to album'),
  artist_id: Yup.number().positive('Must be greater than 0').required('Need artist ID to add the album on'),
});

interface AddAlbumProps {
  fetcher: FetcherWithComponents<album>;
}

/**
 * This component renders a form for adding a new album to a selected artist.
 * It allows users to input the album title and then submits the data to the server.
 *
 * @returns {ReactElement} The rendered AddAlbum component.
 */

const AddAlbum = ({ fetcher }: AddAlbumProps): ReactElement => {
  const formik = useFormik<album>({
    initialValues: { title: '', album_id: 0, artist_id: 1 },
    validationSchema: validationSchema,
    onSubmit: async values => {
      await handleSubmitAlbumOnArtist(values, formik, fetcher.submit);
    },
  });

  return (
    <fetcher.Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv>
        <TextInput<album>
          formik={formik}
          name={'title'}
          label={'Album Title'}
          searchParams={`albums?title=${formik.values.title}`}
          variant={'outlined'}
          handleBlur={handleFormikBlur}
          slotProps={{ input: { sx: { backgroundColor: Theme.palette.background.default } } }}
        />

        <ButtonGroup fullWidth>
          <Button
            type='submit'
            disabled={formik.isSubmitting}
            variant='contained'
            color='primary'
            sx={{ fontWeight: 'bold' }}
          >
            Submit
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={{ fontWeight: 'bold' }}>
            Clear
          </Button>
        </ButtonGroup>
      </CenteredFlexDiv>
    </fetcher.Form>
  );
};

export default AddAlbum;
