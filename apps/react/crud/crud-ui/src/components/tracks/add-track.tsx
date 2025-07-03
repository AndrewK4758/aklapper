import type { track } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import { Decimal } from '@prisma/client/runtime/index-browser.js';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import { type FormikProps, useFormik } from 'formik';
import type { ChangeEvent, FocusEvent, RefObject } from 'react';
import { Form } from 'react-router';

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

const AddTrack = ({ albumID, apiRef }: AddTrackProps) => {
  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: values => {
      handleSubmitNewTrack(values, formik, albumID, apiRef);
    },
    validateOnBlur: true,
  });

  formik.handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    formik.values.name = name;
  };

  formik.handleBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => {
    handleNewTrackBlur(e, formik, albumID);
  };

  return (
    <Container sx={{ borderBottom: '3px solid purple' }}>
      <Form method='post' onSubmit={formik.handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormLabel htmlFor='track-name' hidden>
            Enter Track Name
          </FormLabel>
          <TextField
            autoComplete='off'
            name='track-name'
            id='track-name'
            variant='outlined'
            color='primary'
            placeholder='Enter Track Name'
            sx={{ flex: '1 0 50%' }}
            onChange={e => formik.handleChange(e)}
            onBlur={e => formik.handleBlur(e)}
          />

          {typeof formik.touched.name === 'string' && formik.values.name ? (
            <Text variant='body1' children={formik.touched.name} />
          ) : null}
          {formik.errors.name && formik.touched.name === true ? (
            <Text variant='body1' children={formik.errors.name} />
          ) : null}
        </Box>

        <Box sx={{ display: 'flex', justifyItems: 'center' }}>
          <Button type='submit' variant='contained' color='primary' sx={{ m: 1, flex: '1 0 30%' }}>
            Submit
          </Button>
          <Button type='reset' variant='contained' color='secondary' sx={{ m: 1, flex: '1 0 30%' }}>
            Clear
          </Button>
        </Box>
      </Form>
    </Container>
  );
};

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
