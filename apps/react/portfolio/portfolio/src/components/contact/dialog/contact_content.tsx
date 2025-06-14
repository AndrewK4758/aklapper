import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import { Suspense, type ReactNode } from 'react';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';

interface ContactContentProps {
  element: ReactNode;
  width: string | number;
}

export default function ContactContent({ width, element }: ContactContentProps) {
  return (
    <Box width={width}>
      <Suspense fallback={<Waiting src={waiting} />}>{element}</Suspense>
    </Box>
  );
}
