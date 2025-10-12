import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useState, type ReactElement, type ReactNode } from 'react';
import styles from '../../styles/contact_dialog.module.css';
import CloseDialog from './dialog/close_contact_dialog';
import ContactContent from './dialog/contact_content';
import TabsSelector from './dialog/tabs_selector';

//TODO - Add multi language selector for the localization provider and my text content

interface ContactDialogProps {
  handleClose: () => void;
}

export default function ContactDialog({
  handleClose,
}: ContactDialogProps): ReactElement<ContactDialogProps> | ReactNode {
  const [tab, setTab] = useState(0);

  const handleSetTab = (idx: number) => {
    setTab(idx);
  };

  return (
    <>
      <DialogTitle>
        <TabsSelector tab={tab} handleSetTab={handleSetTab} />
      </DialogTitle>
      <DialogContent>
        <ContactContent tab={tab} handleIsOpen={handleClose} />
      </DialogContent>
      <DialogActions>
        <CloseDialog className={styles.close} handleIsOpen={handleClose} />
      </DialogActions>
    </>
  );
}
