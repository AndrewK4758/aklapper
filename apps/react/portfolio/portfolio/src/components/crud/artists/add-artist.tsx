import { FormikValidationError } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import { useFormik } from 'formik';
import type { Dispatch, FocusEvent, JSX, SetStateAction } from 'react';
import { Form } from 'react-router';
import handleSubmitNewArtist from '../../../services/actions/crud-actions/submit-artist-action.jsx';
import handleNewArtistBlur from '../../../services/events/crud-events/handle-validate-artist-on-blur.jsx';
import { crudAddButtonStyles, crudAddErrorTextStyles } from '../../../styles/crud-styles.jsx';
import { flexColumnStyles } from '../../../styles/pages-styles.jsx';
import type { artist } from '../../../types/prisma_types.js';

interface AddArtistProps {
  rowCountState: number;
  setRowCountState: Dispatch<SetStateAction<number>>;
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
 * @returns {JSX.Element} The rendered AddArtist component.
 */

const AddArtist = ({ rowCountState, setRowCountState, COUNT }: AddArtistProps): JSX.Element => {
  const formik = useFormik({
    initialValues: { name: '', artist_id: COUNT + 1 } as artist,
    onSubmit: values => {
      setRowCountState(rowCountState + 1);
      handleSubmitNewArtist(values, formik);
    },
    validateOnBlur: true,
    validateOnMount: false,
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => {
    handleNewArtistBlur<artist>(e, formik);
  };

  return (
    <Container
      component={'div'}
      id='add-artist-container'
      key={'add-artist-container'}
      sx={{ borderRadius: 1, paddingY: 2 }}
    >
      <Form method='post' onSubmit={formik.handleSubmit}>
        <Box key={'add-artist-box'} id={'add-artist-box'} sx={flexColumnStyles}>
          <FormLabel htmlFor='name' hidden>
            Enter Artist Name
          </FormLabel>
          <TextField
            autoComplete='off'
            name='name'
            id='name'
            variant='outlined'
            color='primary'
            value={formik.values.name}
            placeholder='Enter Artist Name'
            onChange={formik.handleChange}
            onBlur={e => formik.handleBlur(e)}
          />
          <FormikValidationError<artist> formik={formik} elementName={'name'} helperTextSx={crudAddErrorTextStyles} />
        </Box>

        <Container sx={{ display: 'flex', justifyItems: 'center' }}>
          <Button type='submit' variant='contained' color='primary' sx={crudAddButtonStyles}>
            {formik.isSubmitting ? 'Submitting' : 'Submit'}
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={crudAddButtonStyles}>
            Clear
          </Button>
        </Container>
      </Form>
    </Container>
  );
};

export default AddArtist;
