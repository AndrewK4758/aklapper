import type { album } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { useState, type Dispatch, type FocusEvent, type ReactElement, type SetStateAction } from 'react';
import { Form, useParams } from 'react-router';
import handleSubmitAlbumOnArtist from '../../../services/actions/crud-actions/submit-album-on-artist-action.jsx';
import { handleBlur } from '../../../utils/utils.js';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import HelperTextBox from '../../styled/helper_text_box.js';
import TextInput from '../../styled/text_input.js';

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
  const [helperText, setHelperText] = useState<string | null>(null);
  const { artistID } = useParams() as { artistID: string };
  const formik = useFormik({
    initialValues: { title: '', album_id: 0, artist_id: 0 },
    onSubmit: async values => {
      await handleSubmitAlbumOnArtist(values.title, formik, parseInt(artistID, 10), setRows);
    },
    validateOnBlur: true,
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => {
    handleBlur<album>(e, formik, setHelperText, `/albums/${formik.values.title}`);
  };

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv>
        <HelperTextBox>
          <TextInput<album>
            formik={formik}
            name={'title'}
            label={'Album Title'}
            setHelperText={setHelperText}
            variant='outlined'
          />
          {helperText && <Text variant='caption' children={helperText} />}
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

export default AddAlbumOnArtist;
