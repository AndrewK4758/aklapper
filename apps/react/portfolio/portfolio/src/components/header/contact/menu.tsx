import Box from '@mui/material/Box';
import { useState } from 'react';
import ContactDialog from '../../contact/contact_dialog';
import AnimatedContactMenu from './animated_contact_menu';
import ToggleMenuButton from './toggle_menu_button';

export type ContactMenuState = 'open' | 'closed';

export default function Menu() {
  const [openEmail, setOpenEmail] = useState(false);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState<ContactMenuState>('closed');

  const handleToggleContactMenu = () => {
    if (isContactMenuOpen === 'open') setIsContactMenuOpen('closed');

    if (isContactMenuOpen === 'closed') setIsContactMenuOpen('open');
  };

  const handleOpenEmail = () => {
    setOpenEmail(!openEmail);
  };

  console.log(isContactMenuOpen);

  return (
    <>
      <ToggleMenuButton isToggledOpen={isContactMenuOpen} handleToggleContactMenu={handleToggleContactMenu} />
      <AnimatedContactMenu
        id='contact-menu-box'
        isOpen={isContactMenuOpen ?? 'closed'}
        handleOpenEmail={handleOpenEmail}
      />
      {openEmail && (
        <Box component={'div'} id='email-form-wrapper' data-testid='email-form-wrapper' width={'100%'}>
          <ContactDialog isOpen={openEmail} handleIsOpen={handleOpenEmail} />
        </Box>
      )}
    </>
  );
}
