import Box from '@mui/material/Box';
import type { ReactNode, RefObject } from 'react';
import RevealWrapper, { type RevealWrapperProps } from '../../styled/reval_wrapper';

interface ContactRevealWrapperProps extends RevealWrapperProps {
  contactRef: RefObject<HTMLDivElement | null>;
  children: ReactNode | ReactNode[];
  dynamicWidth: number;
}

export default function ContactRevealWrapper({
  isOpen,
  contactRef,
  children,
  dynamicWidth,
}: ContactRevealWrapperProps) {
  return (
    <Box ref={contactRef} flex={1}>
      <RevealWrapper isOpen={isOpen}>
        <Box minWidth={dynamicWidth} width={'100%'} height={'100%'}>
          {children}
        </Box>
      </RevealWrapper>
    </Box>
  );
}
