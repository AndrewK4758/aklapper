import Box from '@mui/material/Box';
import { memo } from 'react';
import ContactDialog from '../contact/contact_dialog';
import AnimatedContactMenu from './contact/animated_contact_menu';
import ToggleMenuButton from './contact/toggle_menu_button';

interface HeaderContactMenuProps {
  isContactMenuOpen: boolean;
  openEmail: boolean;
  handleToggleContactMenu: () => void;
  handleOpenEmail: () => void;
}

const HeaderContactMenu = memo(function ({
  isContactMenuOpen,
  openEmail,
  handleOpenEmail,
  handleToggleContactMenu,
}: HeaderContactMenuProps) {
  return (
    <>
      <Box component={'header'} sx={{ display: 'flex', height: '90px' }}>
        <ToggleMenuButton isToggledOpen={isContactMenuOpen} handleToggleContactMenu={handleToggleContactMenu} />
        <AnimatedContactMenu isOpen={isContactMenuOpen} handleOpenEmail={handleOpenEmail} />
      </Box>
      {openEmail && (
        <Box id='email-form-wrapper' data-testid='email-form-wrapper' sx={{ width: '100%' }}>
          <ContactDialog isOpen={openEmail} handleIsOpen={handleOpenEmail} />
        </Box>
      )}
    </>
  );
});

export default HeaderContactMenu;
