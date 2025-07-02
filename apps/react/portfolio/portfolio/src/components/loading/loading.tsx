import { Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material/Container';
import LinearProgress from '@mui/material/LinearProgress';
import { useEffect, useState, type JSX } from 'react';

const loadingValues = [
  'Creating Instance',
  'Saving to Maps & DB',
  'Creating Players',
  'Registering on Game Instance',
  'Verify Ready to Play Status',
  'Set Players on Start',
];

/**
 * This component renders a loading screen with a progress bar and text updates.
 *
 * @returns {JSX.Element} The rendered GameLoading component.
 */

const GameLoading = (): JSX.Element => {
  const [loadingValueIdx, setLoadingValueIdx] = useState(0);

  const loadingValue = loadingValues[loadingValueIdx];

  useEffect(() => {
    const timer = setInterval(() => {
      setLoadingValueIdx(prev => (prev === 5 ? 0 : prev + 1));
    }, 500);

    return () => clearInterval(timer);
  });

  return (
    <Container fixed={false} maxWidth={false}>
      <Box as={'div'} id='game-loading'>
        <LinearProgress variant='determinate' value={(loadingValueIdx + 1) * 16.67} />
      </Box>
      <Box>
        <Text variant='h5' children={loadingValue} />
      </Box>
    </Container>
  );
};

export default GameLoading;
