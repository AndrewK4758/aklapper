import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import { lazy, useState, type ReactNode } from 'react';
import ContactContent from './dialog/contact_content';
import DialogLayout from './dialog/dialog';
import TabsSelector from './dialog/tabs_selector';

const GoogleCalendar = lazy(() => import('./google-calendar/google-calendar'));
const EmailForm = lazy(() => import('./email-form/email-form'));

//TODO - Add multi language selector for the localization provider and my text content

interface EmailDialogProps {
  isOpen: boolean;
  handleIsOpen: () => void;
}

export default function ContactDialog({ isOpen, handleIsOpen }: EmailDialogProps) {
  const [tab, setTab] = useState(0);

  const handleSetTab = (idx: number) => {
    setTab(idx);
  };

  return (
    <DialogLayout isOpen={isOpen} tab={tab} handleSetTab={handleSetTab}>
      <TabsSelector tab={tab} handleSetTab={handleSetTab} />

      <ContactContent element={renderedElement(tab, handleIsOpen)} />

      <DialogActions>
        <Button type='button' id='close-email-me-button' data-testid='close-email-me-button' onClick={handleIsOpen}>
          Close
        </Button>
      </DialogActions>
    </DialogLayout>
  );
}

function renderedElement(tab: number, handleIsOpen: () => void): ReactNode {
  switch (tab) {
    case 0:
      return <GoogleCalendar setOpen={handleIsOpen} />;
    case 1:
      return <EmailForm setOpen={handleIsOpen} />;
    default:
      return null;
  }
}
