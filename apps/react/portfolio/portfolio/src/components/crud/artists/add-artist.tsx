import type { artist } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import TextField from '@mui/material/TextField';
import { useFormik } from 'formik';
import { useState, type FocusEvent, type ReactElement } from 'react';
import { Form } from 'react-router';
import handleSubmitNewArtist from '../../../services/actions/crud-actions/submit-artist-action';
import { handleBlur, handlelFocus } from '../../../utils/utils';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import HelperTextBox from '../../styled/helper_text_box.js';

interface AddArtistProps {
  rowCountState: number;
  setRowCountState: (rowCount: number) => void;
  COUNT: number;
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

const AddArtist = ({ rowCountState, setRowCountState, COUNT }: AddArtistProps): ReactElement => {
  const [helperText, setHelperText] = useState<string | null>(null);

  const formik = useFormik({
    initialValues: { name: '', artist_id: COUNT + 1 } as artist,
    onSubmit: async values => {
      setRowCountState(rowCountState + 1);
      await handleSubmitNewArtist(values, formik);
    },
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement>) =>
    //TODO crate param type to help validate correct string for url endpoint
    handleBlur<artist>(e, formik, setHelperText, `artists?name=${formik.values.name}`);

  return (
    <Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
      <CenteredFlexDiv id='add-artist-container'>
        <HelperTextBox>
          <TextField
            autoComplete='off'
            name='name'
            id='name'
            fullWidth={true}
            label={'Artist Name'}
            variant='outlined'
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            onFocus={e => handlelFocus(e, formik)}
            error={formik.touched.name && !!formik.errors.name}
            helperText={formik.touched.name && formik.errors.name}
          />
          {helperText && <Text variant='caption' children={helperText} />}
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
