import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import { Decimal } from 'decimal.js';
import { useFormik, type FormikProps } from 'formik';
import { type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Form } from 'react-router';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import TextInput from '../../text_input/text_input.js';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

interface AddTrackProps {
  albumID: string;
  setRows: Dispatch<SetStateAction<track[] | null>>;
}

const initialValues: track = {
  track_id: 0,
  name: '',
  album_id: 0,
  media_type_id: 0,
  genre_id: 0,
  milliseconds: 0,
  bytes: 0,
  unit_price: new Decimal(0.0),
  composer: '',
};

/**
 * This component renders a form for adding a new track to a specific album.
 * It allows users to input the track name and then submits the data to the server.
 *
 * @param {AddTrackProps} props - The props for the AddTrack component.
 * @param {number} props.albumID - The ID of the album to add the track to.
 * @returns {ReactElement} The rendered AddTrack component.
 */

const AddTrack = ({ albumID, setRows }: AddTrackProps): ReactElement => {
  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: values => {
      handleSubmitNewTrack(values, formik, albumID, setRows);
    },
    validateOnBlur: true,
  });

  return (
    <Form method='post' onSubmit={formik.handleSubmit}>
      <CenteredFlexDiv>
        <TextInput<track>
          formik={formik}
          name={'name'}
          label={'Track Name'}
          variant='outlined'
          searchParams={`tracks?albumID=${albumID}&name=${formik.values.name}`}
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

/**
 * This function handles the submission of the new track form.
 * It sends a POST request to the server with the track data and updates the DataGrid with the new track.
 *
 * @param {track} values - The track data from the form.
 * @param {FormikProps<track>} formik - The Formik props object.
 * @param {string} albumID - The ID of the album to add the track to.
 */

const handleSubmitNewTrack = async (
  values: track,
  formik: FormikProps<track>,
  albumID: string,
  setRows: Dispatch<SetStateAction<track[] | null>>,
) => {
  try {
    const trackName = values.name;
    console.log(trackName);
    const resp = await axios.post(
      `${baseURL}/tracks`,
      { name: trackName, albumID: albumID },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { message, value } = resp.data as CRUD_ApiResponse<track>;

    console.log(message);

    setRows(prev => prev && [...prev, value]);
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ name: errorMessage });
  } finally {
    formik.setSubmitting(false);
    formik.resetForm();
  }
};

export default AddTrack;
