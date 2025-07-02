import type { album } from '@aklapper/chinook-client';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Form } from 'react-router';
import * as Yup from 'yup';
import handleSubmitAlbumOnArtist from '../../../services/actions/crud-actions/submit-album-on-artist-action';
import Theme from '../../../styles/themes/theme';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import TextInput from '../../styled/text_input';

const validationSchema = Yup.object<album>({
  title: Yup.string().required('Must have title to album'),
  artist_id: Yup.number().positive('Must be greater than 0').required('Need artist ID to add the album on'),
});

interface AddAlbumProps {
  setRows: Dispatch<SetStateAction<album[] | null>>;
}

/**
 * This component renders a form for adding a new album to a selected artist.
 * It allows users to input the album title and then submits the data to the server.
 *
 * @returns {ReactElement} The rendered AddAlbum component.
 */

const AddAlbum = ({ setRows }: AddAlbumProps): ReactElement => {
  const formik = useFormik<album>({
    initialValues: { title: '', album_id: 0, artist_id: 1 },
    validationSchema: validationSchema,
    onSubmit: async values => {
      await handleSubmitAlbumOnArtist(values.title, formik, values.artist_id, setRows);
    },
  });

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv>
        <TextInput<album>
          formik={formik}
          name={'title'}
          label={'Album Title'}
          variant={'outlined'}
          slotProps={{ input: { sx: { backgroundColor: Theme.palette.background.default } } }}
        />

        <TextInput<album>
          formik={formik}
          name={'album_id'}
          label={'Album Id'}
          variant={'outlined'}
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
    </Form>
  );
};

export default AddAlbum;
