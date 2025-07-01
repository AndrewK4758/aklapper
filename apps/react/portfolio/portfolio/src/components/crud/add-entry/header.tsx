import { Text } from '@aklapper/react-shared';
import DialogTitle from '@mui/material/DialogTitle';
import Theme from '../../../styles/themes/theme';
import CenteredFlexDiv from '../../styled/centered_flexbox';

export default function AddEntryHeader() {
  return (
    <CenteredFlexDiv sx={{ gap: Theme.spacing(2) }}>
      <DialogTitle variant='h4' sx={{ p: 0 }}>
        Add New Entry
      </DialogTitle>
      <Text variant='caption' color='textSecondary'>
        All fields are required to submit entry. Artist, Album, and Track ID's will be automatically generated and
        provided to you upon successful submission
      </Text>
    </CenteredFlexDiv>
  );
}
