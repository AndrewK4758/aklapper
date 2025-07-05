import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import ContactDialog from '../contact/contact_dialog';
import AnimatedContactMenu from './contact/animated_contact_menu';
import ToggleMenuButton from './contact/toggle_menu_button';

interface HeaderContactMenuProps {
  isContactMenuOpen: boolean;
  openEmail: boolean;
  handleToggleContactMenu: () => void;
  handleOpenEmail: () => void;
}

export function HeaderContactMenu({
  isContactMenuOpen,
  openEmail,
  handleOpenEmail,
  handleToggleContactMenu,
}: HeaderContactMenuProps) {
  return (
    <>
      <Box as={'header'} className={css({ display: 'flex', height: '90px' })}>
        <ToggleMenuButton isToggledOpen={isContactMenuOpen} handleToggleContactMenu={handleToggleContactMenu} />
        <AnimatedContactMenu isOpen={isContactMenuOpen} handleOpenEmail={handleOpenEmail} />
      </Box>
      {openEmail && (
        <Box id='email-form-wrapper' data-testid='email-form-wrapper' className={css({ width: '100%' })}>
          <ContactDialog isOpen={openEmail} handleIsOpen={handleOpenEmail} />
        </Box>
      )}
    </>
  );
}

export default HeaderContactMenu;
