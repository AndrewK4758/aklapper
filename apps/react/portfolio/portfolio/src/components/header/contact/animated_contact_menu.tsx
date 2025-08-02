import { RevealWrapper } from '@aklapper/react-shared';
import ContactMenu from './contact_menu';

interface AnimatedContactMenuProps {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function AnimatedContactMenu({ isOpen, handleOpenEmail }: AnimatedContactMenuProps) {
  return (
    <RevealWrapper isOpen={isOpen} data-testid={'contact-reveal-wrapper'}>
      <ContactMenu isOpen={isOpen} handleOpenEmail={handleOpenEmail} />
    </RevealWrapper>
  );
}
