import type { artist } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useFormik } from 'formik';
import { useState, type Dispatch, type FocusEvent, type ReactElement, type SetStateAction } from 'react';
import { Form } from 'react-router';
import handleSubmitNewArtist from '../../../services/actions/crud-actions/submit-artist-action';
import { handleBlur } from '../../../utils/utils';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import HelperTextBox from '../../styled/helper_text_box.js';
import TextInput from '../../styled/text_input';

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
  const [helperText, setHelperText] = useState<string | null>(null);

  const formik = useFormik({
    initialValues: { name: '', artist_id: COUNT + 1 } as artist,
    onSubmit: async values => {
      await handleSubmitNewArtist(values, formik, setRows);
      setRowCountState(rowCountState + 1);
    },
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement>) =>
    //TODO crate param type to help validate correct string for url endpoint
    handleBlur<artist>(e, formik, setHelperText, `artists?name=${formik.values.name}`);

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv id='add-artist-container'>
        <HelperTextBox>
          <TextInput<artist> name='name' label='Artist Name' formik={formik} variant='outlined' />
          {helperText && <Text variant='caption' color='textSecondary' children={helperText} tabIndex={-1} />}
        </HelperTextBox>

        <ButtonGroup fullWidth>
          <Button disabled={formik.isSubmitting} type='submit' variant='contained' color='primary'>
            {formik.isSubmitting ? 'Submitting' : 'Submit'}
          </Button>
          <Button type='reset' variant='contained' color='secondary'>
            Clear
          </Button>
        </ButtonGroup>
      </CenteredFlexDiv>
    </Form>
  );
};

export default AddArtist;
