import type { album } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { useState, type Dispatch, type FocusEvent, type ReactElement, type SetStateAction } from 'react';
import { Form } from 'react-router';
import * as Yup from 'yup';
import handleSubmitAlbumOnArtist from '../../../services/actions/crud-actions/submit-album-on-artist-action';
import { handleBlur } from '../../../utils/utils';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import HelperTextBox from '../../styled/helper_text_box';
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
  const [albumHelperText, setAlbumHelperText] = useState<string | null>(null);

  const formik = useFormik<album>({
    initialValues: { title: '', album_id: 0, artist_id: 1 },
    validationSchema: validationSchema,
    onSubmit: async values => {
      await handleSubmitAlbumOnArtist(values.title, formik, values.artist_id, setRows);
    },
    validateOnBlur: true,
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement>) =>
    handleBlur<album>(
      e,
      formik,
      setAlbumHelperText,
      `albums?title=${formik.values.title}&artistID=${formik.values.artist_id}`,
    );

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv>
        <HelperTextBox>
          <TextInput<album> label='Album Name' formik={formik} name={'title'} variant='outlined' />
          {albumHelperText && <Text variant='caption' children={albumHelperText} />}
        </HelperTextBox>

        <HelperTextBox>
          <TextInput<album> label='Artist ID' formik={formik} name='artist_id' variant='outlined' />
          {albumHelperText && <Text variant='caption' children={albumHelperText} />}
        </HelperTextBox>
      </CenteredFlexDiv>

      <ButtonGroup fullWidth>
        <Button type='submit' variant='contained' color='primary'>
          Submit
        </Button>
        <Button type='reset' variant='contained' color='secondary'>
          Clear
        </Button>
      </ButtonGroup>
    </Form>
  );
};

export default AddAlbum;
