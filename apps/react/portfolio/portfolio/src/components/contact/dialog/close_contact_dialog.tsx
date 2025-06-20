import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import type { ReactElement } from 'react';
import ContactDialogButton from '../../styled/base_button.js';

interface CloseDialogProps extends DialogActionsProps {
  handleIsOpen: () => void;
}

export default function CloseDialog({ handleIsOpen, ...props }: CloseDialogProps): ReactElement<CloseDialogProps> {
  return (
    <DialogActions {...props}>
      <ContactDialogButton
        variant='outlined'
        id='close-email-me-button'
        data-testid='close-email-me-button'
        onClick={handleIsOpen}
      >
        Close
      </ContactDialogButton>
    </DialogActions>
  );
}
