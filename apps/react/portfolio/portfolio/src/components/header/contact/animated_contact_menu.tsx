import Box from '@mui/material-pigment-css/Box';
import { css } from '@pigment-css/react';
import RevealWrapper from '../../styled/reval_wrapper';
import ContactMenu from './contact_menu';

interface AnimatedContactMenuProps {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function AnimatedContactMenu({ isOpen, handleOpenEmail }: AnimatedContactMenuProps) {
  return (
    <RevealWrapper isOpen={isOpen} data-testid={'contact-reveal-wrapper'}>
      {isOpen && (
        <Box
          className={css({
            minWidth: '90vw',
            width: '100%',
            height: '100%',
          })}
        >
          <ContactMenu isOpen={isOpen} handleOpenEmail={handleOpenEmail} />
        </Box>
      )}
    </RevealWrapper>
  );
}
