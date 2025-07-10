import { useState, type ReactElement } from 'react';
import CloseDialog from './dialog/close_contact_dialog';
import ContactContent from './dialog/contact_content';
import DialogLayout from './dialog/dialog_layout.js';
import TabsSelector from './dialog/tabs_selector';

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

      <ContactContent tab={tab} handleIsOpen={handleIsOpen} />

      <CloseDialog handleIsOpen={handleIsOpen} />
    </DialogLayout>
  );
}
