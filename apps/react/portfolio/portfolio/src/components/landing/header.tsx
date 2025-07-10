import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import { typewriter } from '../../styles/base/animations';

interface TypewriterTextProps {
  isLandingNavOpen: boolean;
}

const TypewriterText = styled(Box, { shouldForwardProp: prop => prop !== 'isLandingNavOpen' })<TypewriterTextProps>(
  () => ({
    overflow: 'hidden',
    fontFamily: 'Orange Gummy',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    justifyItems: 'center',
    width: 0,
    margin: 0,
    fontSize: '6rem',
    '@media (max-width: 1200px)': {
      fontSize: '3rem',
    },
    variants: [
      {
        props: { isLandingNavOpen: false },
        style: {
          fontSize: '6rem',
          animation: `${typewriter} 4s steps(55) forwards`,
        },
      },
      {
        props: { isLandingNavOpen: true },
        style: {
          width: '100%',
        },
      },
    ],
  }),
);

interface LandingHeaderProps {
  isLandingNavOpen: boolean;
}

export default function Header({ isLandingNavOpen }: LandingHeaderProps) {
  return (
    <Box className='typewriter' sx={{ display: 'flex', justifyContent: 'center' }}>
      <TypewriterText isLandingNavOpen={isLandingNavOpen}>SOMETHING IS TRYING TO ESCAPE!</TypewriterText>
    </Box>
  );
}
