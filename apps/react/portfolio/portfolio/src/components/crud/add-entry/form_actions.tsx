import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import DialogActions from '@mui/material/DialogActions';
import type { FormikProps } from 'formik';
import { useNavigate } from 'react-router';
import type { NewEntry } from '../../../types/types';

interface AddEntryFormActionsProps {
  allStepsCompleted: () => boolean;
  formik: FormikProps<NewEntry>;
}

export default function AddEntryFormActions({ formik, allStepsCompleted }: AddEntryFormActionsProps) {
  const nav = useNavigate();

  const handleClose = () => {
    nav(-1);
  };

  return (
    <DialogActions sx={{ marginTop: 2 }}>
      <ButtonGroup variant='contained' fullWidth>
        {allStepsCompleted() ? (
          <Button type='submit' disabled={formik.isSubmitting}>
            Submit Entry
          </Button>
        ) : null}
        <Button type='reset'>Reset</Button>
        <Button type='button' onClick={handleClose}>
          Close
        </Button>
      </ButtonGroup>
    </DialogActions>
  );
}
