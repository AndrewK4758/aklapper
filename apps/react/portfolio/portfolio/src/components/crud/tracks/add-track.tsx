import type { track } from '@aklapper/chinook-client';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { Decimal } from 'decimal.js';
import { useFormik } from 'formik';
import { type ReactElement } from 'react';
import { type FetcherWithComponents } from 'react-router';
import handleSubmitNewTrack from '../../../services/actions/crud-actions/handle_submit_new_track';
import { BACKGROUND_DEFAULT } from '../../../styles/base/base_styles';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import TextInput from '../../text_input/text_input.js';

interface AddTrackProps {
  albumID: string;
  fetcher: FetcherWithComponents<track>;
}

/**
 * This component renders a form for adding a new track to a specific album.
 * It allows users to input the track name and then submits the data to the server.
 *
 * @param {AddTrackProps} props - The props for the AddTrack component.
 * @param {number} props.albumID - The ID of the album to add the track to.
 * @returns {ReactElement} The rendered AddTrack component.
 */

const AddTrack = ({ albumID, fetcher }: AddTrackProps): ReactElement => {
  const initialValues: track = {
    track_id: 0,
    name: '',
    album_id: parseInt(albumID, 10),
    media_type_id: 0,
    genre_id: 0,
    milliseconds: 0,
    bytes: 0,
    unit_price: new Decimal(0.0),
    composer: '',
  };
  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: values => {
      handleSubmitNewTrack(values, formik, fetcher.submit);
    },
    validateOnBlur: true,
  });

  return (
    <fetcher.Form method='post' onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
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
    </fetcher.Form>
  );
};

export default AddTrack;
