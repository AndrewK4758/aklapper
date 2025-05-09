import { FormikValidationError } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import { Decimal } from 'decimal.js';
import { type FormikProps, useFormik } from 'formik';
import type { FocusEvent, JSX, RefObject } from 'react';
import { Form } from 'react-router';
import { crudAddButtonStyles, crudAddErrorTextStyles } from '../../../styles/crud-styles.jsx';
import type { track } from '../../../types/prisma_types.js';

const baseURL = import.meta.env.VITE_DATA_API_URL;

interface AddTrackProps {
  albumID: number;
  apiRef: RefObject<GridApiCommunity | null>;
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
 * @param {RefObject<GridApiCommunity>} props.apiRef - A ref to the DataGrid API object.
 * @returns {JSX.Element} The rendered AddTrack component.
 */

const AddTrack = ({ albumID, apiRef }: AddTrackProps): JSX.Element => {
  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: values => {
      handleSubmitNewTrack(values, formik, albumID, apiRef);
    },
    validateOnBlur: true,
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => {
    handleNewTrackBlur(e, formik, albumID);
  };

  return (
    <Container sx={{ borderRadius: 1, paddingY: 1 }}>
      <Form method='post' onSubmit={formik.handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormLabel htmlFor='track-name' hidden>
            Enter Track Name
          </FormLabel>
          <TextField
            autoComplete='off'
            name='name'
            id='name'
            variant='outlined'
            color='primary'
            placeholder='Enter Track Name'
            onChange={e => formik.setFieldValue('name', e.target.value)}
            onBlur={e => formik.handleBlur(e)}
            value={formik.values.name}
          />

          <FormikValidationError<track> formik={formik} elementName={'name'} helperTextSx={crudAddErrorTextStyles} />
        </Box>

        <Box sx={{ display: 'flex', justifyItems: 'center' }}>
          <Button type='submit' variant='contained' color='primary' sx={crudAddButtonStyles}>
            Submit
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={crudAddButtonStyles}>
            Clear
          </Button>
        </Box>
      </Form>
    </Container>
  );
};

/**
 * This function handles the submission of the new track form.
 * It sends a POST request to the server with the track data and updates the DataGrid with the new track.
 *
 * @param {track} values - The track data from the form.
 * @param {FormikProps<track>} formik - The Formik props object.
 * @param {number} albumID - The ID of the album to add the track to.
 * @param {RefObject<GridApiCommunity>} apiRef - A ref to the DataGrid API object.
 */

const handleSubmitNewTrack = async (
  values: track,
  formik: FormikProps<track>,
  albumID: number,
  apiRef: RefObject<GridApiCommunity | null>,
) => {
  try {
    const trackName = values.name;
    const resp = await axios.post(
      `${baseURL}/tracks`,
      { name: trackName, albumID: albumID },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (resp.data.newTrack && apiRef.current) {
      const { name, track_id, milliseconds, media_type_id, genre_id, bytes, composer, unit_price } = resp.data
        .newTrack as track;

      apiRef.current.updateRows([
        {
          track_id: track_id,
          name: name,
          milliseconds: milliseconds,
          media_type_id: media_type_id,
          genre_id: genre_id,
          bytes: bytes,
          composer: composer,
          unit_price: unit_price,
        },
      ]);
    }
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ name: errorMessage });
  }
};

/**
 * This function handles the blur event of the track name input field.
 * It sends a GET request to the server to check if the track name already exists and updates the Formik state accordingly.
 *
 * @param {FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>} e - The blur event object.
 * @param {FormikProps<track>} formik - The Formik props object.
 * @param {number} albumID - The ID of the album to add the track to.
 */

const handleNewTrackBlur = async (
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  formik: FormikProps<track>,
  albumID: number,
) => {
  try {
    const resp = await axios.get(`${baseURL}/tracks?albumID=${albumID}&name=${e.target.value}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    formik.setTouched({ name: resp.data.message }, true);
    return resp.data.message;
  } catch (error) {
    formik.setErrors({ name: (error as Error).message });
    console.error(error);
  }
};

export default AddTrack;
