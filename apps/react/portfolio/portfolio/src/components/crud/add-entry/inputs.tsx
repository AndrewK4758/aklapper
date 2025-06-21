import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import type { FormikProps } from 'formik';
import type { CompletedState, NewEntry } from '../../../types/types';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import HelperTextBox from '../../styled/helper_text_box';

interface AddEntryFormInputsProps {
  activeStep: number;
  artistHelperText: string | null;
  formik: FormikProps<NewEntry>;
  completed: CompletedState;
  handleArtistFocus: () => void;
}

export default function AddEntryFormInputs({
  activeStep,
  artistHelperText,
  completed,
  formik,
  handleArtistFocus,
}: AddEntryFormInputsProps) {
  return (
    <Box>
      {activeStep === 0 && (
        <HelperTextBox>
          <TextField
            autoComplete='off'
            autoFocus
            name='artist.name'
            id='artist.name'
            label='Artist Name'
            type='text'
            variant='outlined'
            disabled={Object.keys(completed).length > 0}
            value={formik.values.artist.name}
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            onFocus={handleArtistFocus}
            error={formik.touched['artist']?.name && !!formik.errors['artist']?.name}
            helperText={formik.touched['artist']?.name && (formik.errors['artist']?.name as string)}
            fullWidth={true}
          />
          {artistHelperText && <Text variant='caption' children={artistHelperText} marginLeft={1.5} />}
        </HelperTextBox>
      )}
      {activeStep === 1 && (
        <TextField
          fullWidth={true}
          autoComplete='off'
          autoFocus
          name='album.title'
          id='album.title'
          label='Album Title'
          type='text'
          variant='outlined'
          disabled={Object.keys(completed).length > 1}
          value={formik.values.album.title}
          onBlur={formik.handleBlur}
          onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
          onChange={formik.handleChange}
          error={formik.touched['album']?.title && !!formik.errors['album']?.title}
          helperText={formik.touched['album']?.title && (formik.errors['album']?.title as string)}
          sx={{ height: '78px' }}
        />
      )}

      {activeStep === 2 && (
        <CenteredFlexDiv alignItems={'flex-start'} gap={0.5}>
          <TextField
            fullWidth={true}
            autoComplete='off'
            autoFocus
            name='track.name'
            id='track.name'
            label='Track Name'
            type='text'
            variant='outlined'
            disabled={Object.keys(completed).length > 2}
            value={formik.values.track.name}
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.name && !!formik.errors['track']?.name}
            helperText={formik.touched['track']?.name && (formik.errors['track']?.name as string)}
            sx={{ height: '78px' }}
          />

          <TextField
            fullWidth={true}
            autoComplete='off'
            name='track.media_type_id'
            id='track.media_type_id'
            label='Media Type ID'
            type='number'
            variant='outlined'
            disabled={Object.keys(completed).length > 2}
            value={formik.values.track.media_type_id}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.media_type_id && !!formik.errors['track']?.media_type_id}
            helperText={formik.touched['track']?.media_type_id && (formik.errors['track']?.media_type_id as string)}
            sx={{ height: '78px' }}
          />

          <TextField
            fullWidth={true}
            autoComplete='off'
            name='track.genre_id'
            id='track.genre_id'
            label='Genre ID'
            type='number'
            variant='outlined'
            disabled={Object.keys(completed).length > 2}
            value={formik.values.track.genre_id}
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.genre_id && !!formik.errors['track']?.genre_id}
            helperText={formik.touched['track']?.genre_id && (formik.errors['track']?.genre_id as string)}
            sx={{ height: '78px' }}
          />

          <TextField
            fullWidth={true}
            autoComplete='off'
            name='track.composer'
            id='track.composer'
            label='Composer'
            type='text'
            variant='outlined'
            disabled={Object.keys(completed).length > 2}
            value={formik.values.track.composer}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.media_type_id && !!formik.errors['track']?.media_type_id}
            helperText={formik.touched['track']?.media_type_id && (formik.errors['track']?.media_type_id as string)}
            sx={{ height: '78px' }}
          />

          <TextField
            fullWidth={true}
            autoComplete='off'
            name='track.milliseconds'
            id='track.milliseconds'
            label='Milliseconds'
            type='number'
            variant='outlined'
            disabled={Object.keys(completed).length > 2}
            value={formik.values.track.milliseconds}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.milliseconds && !!formik.errors['track']?.milliseconds}
            helperText={formik.touched['track']?.milliseconds && (formik.errors['track']?.milliseconds as string)}
            sx={{ height: '78px' }}
          />

          <TextField
            fullWidth={true}
            autoComplete='off'
            name='track.bytes'
            id='track.bytes'
            label='Bytes'
            type='number'
            variant='outlined'
            disabled={Object.keys(completed).length > 2}
            value={formik.values.track.bytes}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.bytes && !!formik.errors['track']?.bytes}
            helperText={formik.touched['track']?.bytes && (formik.errors['track']?.bytes as string)}
            sx={{ height: '78px' }}
          />

          <TextField
            fullWidth={true}
            autoComplete='off'
            name='track.unit_price'
            id='track.unit_price'
            label='Unit Price'
            type='number'
            slot='step'
            slotProps={{ htmlInput: { step: '0.01' } }}
            variant='outlined'
            inputMode='decimal'
            disabled={Object.keys(completed).length > 2}
            placeholder='Enter price in X.XX format'
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            onFocus={e => formik.setFieldTouched(e.currentTarget.name, false)}
            error={formik.touched['track']?.unit_price && !!formik.errors['track']?.unit_price}
            helperText={formik.touched['track']?.unit_price && (formik.errors['track']?.unit_price as string)}
            sx={{ height: '78px' }}
          />
        </CenteredFlexDiv>
      )}
    </Box>
  );
}
