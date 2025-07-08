import Button from '@mui/material/Button';
import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import type { ReactElement } from 'react';

interface CloseDialogProps extends DialogActionsProps {
  handleIsOpen: () => void;
}

export default function CloseDialog({ handleIsOpen, ...props }: CloseDialogProps): ReactElement<CloseDialogProps> {
  return (
    <DialogActions {...props}>
      <Button variant='outlined' id='close-contact' data-testid='close-contact' onClick={handleIsOpen}>
        Close
      </Button>
    </DialogActions>
  );
}
