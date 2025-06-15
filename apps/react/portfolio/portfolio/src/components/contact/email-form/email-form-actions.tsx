import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import type { FormikProps } from 'formik';
import AnimatedBorderBox from '../../styled/animated_border_box';
import ContactDialogButton from '../../styled/contact_dialgo_button';
import type { MessageMeFormValues } from './email-form';

interface EmailFormActionsProps extends DialogActionsProps {
  formik: FormikProps<MessageMeFormValues>;
  handleFileSubmit: () => void;
}

export default function EmailFormActions({ formik, handleFileSubmit, ...props }: EmailFormActionsProps) {
  return (
    <DialogActions {...props}>
      <ContactDialogButton
        variant='outlined'
        id='upload-file-button'
        data-testid='upload-file-button'
        onClick={handleFileSubmit}
      >
        Upload File
      </ContactDialogButton>
      <AnimatedBorderBox>
        <ContactDialogButton type='submit' id='submit-email-me-button' data-testid='submit-email-me-button'>
          Submit
        </ContactDialogButton>
      </AnimatedBorderBox>
      <ContactDialogButton
        variant='outlined'
        type='reset'
        id='reset-email-me-button'
        data-testid='reset-email-me-button'
        onReset={formik.handleReset}
      >
        Reset
      </ContactDialogButton>
    </DialogActions>
  );
}
