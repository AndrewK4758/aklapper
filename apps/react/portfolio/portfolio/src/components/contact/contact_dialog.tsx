import type { BoxProps } from '@mui/material/Box';
import { lazy, useState, type ReactElement } from 'react';
import CloseDialog from './dialog/close_contact_dialog';
import ContactContent from './dialog/contact_content';
import DialogLayout from './dialog/dialog_layout.js';
import TabsSelector from './dialog/tabs_selector';
import type { GoogleCalendarProps } from './google-calendar/google-calendar';

const GoogleCalendar = lazy(() => import('./google-calendar/google-calendar'));
const EmailForm = lazy(() => import('./email-form/email-form'));

//TODO - Add multi language selector for the localization provider and my text content

interface ContactDialogProps {
  isOpen: boolean;
  handleIsOpen: () => void;
}

export default function ContactDialog({ isOpen, handleIsOpen }: ContactDialogProps): ReactElement<ContactDialogProps> {
  const [tab, setTab] = useState(0);

  const handleSetTab = (idx: number) => {
    setTab(idx);
  };

  return (
    <DialogLayout isOpen={isOpen}>
      <TabsSelector tab={tab} handleSetTab={handleSetTab} />

      <ContactContent element={renderedElement(tab, handleIsOpen)} />

      <CloseDialog handleIsOpen={handleIsOpen} />
    </DialogLayout>
  );
}

function renderedElement(tab: number, handleIsOpen: () => void): ReactElement<GoogleCalendarProps | BoxProps> | null {
  switch (tab) {
    case 0:
      return <GoogleCalendar setOpen={handleIsOpen} />;
    case 1:
      return <EmailForm setOpen={handleIsOpen} />;
    default:
      return null;
  }
}
