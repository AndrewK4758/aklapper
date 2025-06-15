import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import { Suspense, type ReactNode } from 'react';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';

interface ContactContentProps {
  element: ReactNode;
}

export default function ContactContent({ element }: ContactContentProps) {
  console.log(element);
  return (
    <Suspense fallback={<Waiting src={waiting} />}>
      <Box component={'section'} width={'100%'}>
        {element}
      </Box>
    </Suspense>
  );
}
