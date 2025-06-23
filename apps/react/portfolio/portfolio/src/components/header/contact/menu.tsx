import Box from '@mui/material/Box';
import { useState } from 'react';
import ContactDialog from '../../contact/contact_dialog';
import AnimatedContactMenu from './animated_contact_menu';
import ToggleMenuButton from './toggle_menu_button';

interface MenuProps {
  // isContactMenuOpen: boolean;
  // handleToggleContactMenu: () => void;
  // handleOpenMenu: () => void;
  // handleOpenEmail: () => void;
}

export default function Menu(
  {
    // isContactMenuOpen,
    // handleOpenEmail,
    // handleOpenMenu,
    // handleToggleContactMenu,
  }: MenuProps,
) {
  const [openEmail, setOpenEmail] = useState(false);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);

  const handleToggleContactMenu = () => {
    setIsContactMenuOpen(!isContactMenuOpen);
  };

  const handleOpenEmail = () => {
    setOpenEmail(!openEmail);
  };
  return (
    <>
      <ToggleMenuButton isToggledOpen={isContactMenuOpen} handleToggleContactMenu={handleToggleContactMenu} />
      <AnimatedContactMenu id='contact-menu-box' isOpen={isContactMenuOpen} handleOpenEmail={handleOpenEmail} />
      {openEmail && (
        <Box component={'div'} id='email-form-wrapper' data-testid='email-form-wrapper' width={'100%'}>
          <ContactDialog isOpen={openEmail} handleIsOpen={handleOpenEmail} />
        </Box>
      )}
    </>
  );
}
