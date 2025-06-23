import { Waiting } from '@aklapper/react-shared';
import Box, { type BoxProps } from '@mui/material/Box';
import { Suspense, type ReactElement } from 'react';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import type { GoogleCalendarProps } from '../google-calendar/google-calendar';

interface ContactContentProps {
  element: ReactElement<GoogleCalendarProps | BoxProps> | null;
}

export default function ContactContent({ element }: ContactContentProps): ReactElement<ContactContentProps> {
  return (
    <Box component={'section'} width={'100%'}>
      <Suspense fallback={<Waiting src={waiting} />}>{element}</Suspense>
    </Box>
  );
}
