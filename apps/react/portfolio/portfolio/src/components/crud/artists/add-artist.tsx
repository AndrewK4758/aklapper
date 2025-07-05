import type { artist } from '@aklapper/chinook-client';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Form } from 'react-router';
import handleSubmitNewArtist from '../../../services/actions/crud-actions/submit-artist-action';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import TextInput from '../../text_input/text_input.js';

interface AddArtistProps {
  rowCountState: number;
  setRowCountState: (rowCount: number) => void;
  COUNT: number;
  setRows: Dispatch<SetStateAction<artist[] | null>>;
}

/**
 * This component renders a form for adding a new artist to the database.
 * It allows users to input the artist name and then submits the data to the server.
 *
 * @param {AddArtistProps} props - The props for the AddArtist component.
 * @param {number} props.rowCountState - The current number of artists in the database.
 * @param {Dispatch<SetStateAction<number>>} props.setRowCountState - A function to update the number of artists in the database.
 * @param {number} props.COUNT - The initial number of artists in the database.
 * @returns {ReactElement} The rendered AddArtist component.
 */

const AddArtist = ({ rowCountState, setRowCountState, COUNT, setRows }: AddArtistProps): ReactElement => {
  const formik = useFormik({
    initialValues: { name: '', artist_id: COUNT + 1 } as artist,
    onSubmit: async values => {
      await handleSubmitNewArtist(values, formik, setRows);
      setRowCountState(rowCountState + 1);
    },
  });

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv id='add-artist-container'>
        <TextInput<artist>
          name='name'
          label='Artist Name'
          formik={formik}
          variant='outlined'
          searchParams={`artists?name=${formik.values.name}`}
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
            disabled={formik.isSubmitting}
            type='submit'
            color='primary'
            variant='contained'
            sx={{ fontWeight: 'bold' }}
          >
            {formik.isSubmitting ? 'Submitting' : 'Submit'}
          </Button>
          <Button
            type='reset'
            color='secondary'
            variant='contained'
            sx={{
              fontWeight: 'bold',
            }}
          >
            Clear
          </Button>
        </ButtonGroup>
      </CenteredFlexDiv>
    </Form>
  );
};

export default AddArtist;
