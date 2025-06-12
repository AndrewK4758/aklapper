import Box from '@mui/material/Box';
import { useState } from 'react';
import EmailDialog from '../email/email-dialog.js';
import ContactMenu from './contact/contact_menu.js';
import ToggleMenuButton from './contact/toggle_contact_button.js';

export function HeaderContactMenu() {
  const [openEmail, setOpenEmail] = useState<boolean>(false);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);

  const handleOpenContact = () => {
    setIsContactMenuOpen(!isContactMenuOpen);
  };

  const handleOpenEmail = () => {
    setOpenEmail(!openEmail);
  };

  return (
    <>
      <Box component={'header'} display={'flex'}>
        <ToggleMenuButton isToggledOpen={isContactMenuOpen} handleOpenContact={handleOpenContact} />
        <ContactMenu id='contact-menu-box' isOpen={isContactMenuOpen} handleOpenEmail={handleOpenEmail} />
      </Box>
      {openEmail && (
        <Box component={'div'} id='email-form-wrapper' data-testid='email-form-wrapper' width={'100%'}>
          <EmailDialog isOpen={openEmail} handleIsOpen={handleOpenEmail} />
        </Box>
      )}
    </>
  );
}

export default HeaderContactMenu;
