import { useEffect, useRef, useState } from 'react';
import ContactMenu from './contact_menu.js';
import ContactRevealWrapper from './contact_reveal.js';

interface AnimatedContactMenuProps {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function AnimatedContactMenu({ isOpen, handleOpenEmail }: AnimatedContactMenuProps) {
  const [contactWidth, setContactWidth] = useState(0);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = contactRef.current;
    if (element) {
      const width = element.getBoundingClientRect().width;
      setContactWidth(width);
    }
  }, []);

  return (
    <ContactRevealWrapper
      suppressHydrationWarning
      id='contact-menu-box'
      contactRef={contactRef}
      dynamicWidth={contactWidth}
      isOpen={isOpen}
    >
      <ContactMenu isOpen={isOpen} handleOpenEmail={handleOpenEmail} />
    </ContactRevealWrapper>
  );
}
