import { type BoxProps } from '@mui/material/Box';
import { useLayoutEffect, useRef, useState } from 'react';
import ContactMenu from './contact_menu.js';
import ContactRevealWrapper from './contact_reveal.js';

interface AnimatedContactMenuProps extends Omit<BoxProps, 'ref'> {
  isOpen: boolean;
  handleOpenEmail: () => void;
}

export default function AnimatedContactMenu({ isOpen, handleOpenEmail, ...props }: AnimatedContactMenuProps) {
  const [contactWidth, setContactWidth] = useState(0);
  const contactRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = contactRef.current;
    if (element) {
      const width = element.getBoundingClientRect().width;
      setContactWidth(width);
    }
  }, []);

  return (
    <ContactRevealWrapper contactRef={contactRef} dynamicWidth={contactWidth} isOpen={isOpen}>
      <ContactMenu isOpen={isOpen} handleOpenEmail={handleOpenEmail} />
    </ContactRevealWrapper>
  );
}
