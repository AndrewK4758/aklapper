import Box from '@mui/material/Box';
import { type CSSProperties, keyframes } from '@mui/material/styles';
import Theme from '../../styles/theme';

const typewriterStyle: CSSProperties = {
  overflow: 'hidden',
  fontFamily: 'Landing',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  justifyItems: 'center',
  width: 0,
};

keyframes(`
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
`);

const typewriterAnimation: CSSProperties = {
  '@keyframes typewriter': {
    from: { width: 0 },
    to: { width: '100%' },
  },
  animation: `typewriter 4s steps(55) forwards`,
};

const typewriterTextStyle: CSSProperties = {
  fontSize: Theme.containerQueries('lg') ? '6rem' : '3rem',
};

interface LandingHeaderProps {
  landingNavIsOpen: boolean;
}

export default function LandingHeader({ landingNavIsOpen }: LandingHeaderProps) {
  return (
    <Box
      component={'div'}
      className='typewriter'
      sx={!landingNavIsOpen ? { ...typewriterStyle, ...typewriterAnimation } : { ...typewriterStyle, width: '100%' }}
    >
      <Box
        component={'p'}
        className='typewriter-text'
        sx={
          !landingNavIsOpen
            ? {
                ...typewriterStyle,
                ...typewriterTextStyle,
                ...typewriterAnimation,
              }
            : {
                ...typewriterStyle,
                ...typewriterTextStyle,
                width: '100%',
              }
        }
      >
        SOMETHING IS TRYING TO ESCAPE!
      </Box>
    </Box>
  );
}
