import { Text } from '@aklapper/react-shared';
import DialogTitle from '@mui/material/DialogTitle';

export default function AddEntryHeader() {
  return (
    <DialogTitle variant='h4' display={'flex'} flexDirection={'column'}>
      Add New Entry
      <Text variant='caption' color='textSecondary'>
        All fields are required to submit entry. Artist, Album, and Track ID's will be automatically generated and
        provided to you upon successful submission
      </Text>
    </DialogTitle>
  );
}
