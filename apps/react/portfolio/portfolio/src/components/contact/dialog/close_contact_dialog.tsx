import Button from '@mui/material/Button';
import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import type { ReactElement } from 'react';
import Theme from '../../../styles/themes/theme';

interface CloseDialogProps extends DialogActionsProps {
  handleIsOpen: () => void;
}

export default function CloseDialog({ handleIsOpen, ...props }: CloseDialogProps): ReactElement<CloseDialogProps> {
  return (
    <DialogActions {...props}>
      <Button
        variant='outlined'
        id='close-contact'
        data-testid='close-contact'
        onClick={handleIsOpen}
        sx={{ color: Theme.palette.primary.dark, borderColor: Theme.palette.primary.dark }}
      >
        Close
      </Button>
    </DialogActions>
  );
}
