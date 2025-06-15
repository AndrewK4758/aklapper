import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import ContactDialogButton from '../../styled/contact_dialgo_button';

interface CloseDialogProps extends DialogActionsProps {
  handleIsOpen: () => void;
}

export default function CloseDialog({ handleIsOpen, ...props }: CloseDialogProps) {
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
