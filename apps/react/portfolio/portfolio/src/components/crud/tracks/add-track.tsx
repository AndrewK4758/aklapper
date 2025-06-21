import type { track } from '@aklapper/chinook-client';
import { Text } from '@aklapper/react-shared';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import axios, { type AxiosError, type AxiosResponse } from 'axios';
import { Decimal } from 'decimal.js';
import { useFormik, type FormikProps } from 'formik';
import { useState, type FocusEvent, type ReactElement } from 'react';
import { Form } from 'react-router';
import { handleBlur } from '../../../utils/utils.js';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import HelperTextBox from '../../styled/helper_text_box.js';
import TextInput from '../../styled/text_input.js';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

interface AddTrackProps {
  albumID: number;
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

const AddTrack = ({ albumID }: AddTrackProps): ReactElement => {
  const [helperText, setHelperText] = useState<string | null>(null);

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: values => {
      handleSubmitNewTrack(values, formik, albumID);
    },
    validateOnBlur: true,
  });

  formik.handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    handleBlur<track>(e, formik, setHelperText, `tracks?albumID=${albumID}&name=${e.target.value}`);
  };

  return (
    <Form method='post' onSubmit={formik.handleSubmit}>
      <CenteredFlexDiv>
        <HelperTextBox>
          <TextInput<track> formik={formik} name={'name'} label={'Track Name'} />
          {helperText && <Text variant='caption' color='textSecondary' children={helperText} />}
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

/**
 * This function handles the submission of the new track form.
 * It sends a POST request to the server with the track data and updates the DataGrid with the new track.
 *
 * @param {track} values - The track data from the form.
 * @param {FormikProps<track>} formik - The Formik props object.
 * @param {number} albumID - The ID of the album to add the track to.
 */

const handleSubmitNewTrack = async (values: track, formik: FormikProps<track>, albumID: number) => {
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

    console.log(resp.data);
    // if (resp.data.newTrack && apiRef.current) {
    //   const { name, track_id, milliseconds, media_type_id, genre_id, bytes, composer, unit_price } = resp.data
    //     .newTrack as track;

    //   apiRef.current.updateRows([
    //     {
    //       track_id: track_id,
    //       name: name,
    //       milliseconds: milliseconds,
    //       media_type_id: media_type_id,
    //       genre_id: genre_id,
    //       bytes: bytes,
    //       composer: composer,
    //       unit_price: unit_price,
    //     },
    //   ]);
    // }
  } catch (error) {
    console.error(error);
    const errorMessage = await ((error as AxiosError).response as AxiosResponse).data.errorMessage;
    console.log(errorMessage);
    formik.setErrors({ name: errorMessage });
  } finally {
    formik.setSubmitting(false);
  }
};

export default AddTrack;
