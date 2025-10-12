import Box from '@mui/material/Box';
import { memo, useCallback, useState } from 'react';
import styles from '../../styles/header.module.css';
import DialogLayout from '../contact/dialog/dialog_layout';
import AnimatedContactMenu from './contact/animated_contact_menu';
import ToggleMenuButton from './contact/toggle_menu_button';

const HeaderContactMenu = memo(function Header() {
  const [openEmail, setOpenEmail] = useState(false);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);

  const handleToggleContactMenu = useCallback(() => {
    setIsContactMenuOpen(!isContactMenuOpen);
  }, [isContactMenuOpen]);

  const handleOpenEmail = useCallback(() => {
    setOpenEmail(true);
  }, []);

  const handleCloseEmail = useCallback(() => {
    console.log('here');
    setOpenEmail(false);
  }, []);

  return (
    <>
      <Box component={'header'} className={styles.header}>
        <ToggleMenuButton isToggledOpen={isContactMenuOpen} handleToggleContactMenu={handleToggleContactMenu} />
        <AnimatedContactMenu isOpen={isContactMenuOpen} handleOpenEmail={handleOpenEmail} />
      </Box>

      <DialogLayout open={openEmail} handleClose={handleCloseEmail} />
    </>
  );
});

export default HeaderContactMenu;
