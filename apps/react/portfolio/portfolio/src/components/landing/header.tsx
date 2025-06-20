import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme as ThemeType } from '@mui/material/styles';
import Theme from '../../styles/themes/theme.js';

const typewriterBase: SxProps<ThemeType> = {
  overflow: 'hidden',
  fontFamily: 'Landing',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  justifyItems: 'center',
  width: 0,
  m: 0,
};

const typewriter = keyframes`
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
`;

const typewriterAnimation: SxProps<ThemeType> = {
  animation: `${typewriter} 4s steps(55) forwards`,
};

const typewriterTextStyle: SxProps<ThemeType> = {
  fontSize: '6rem',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '3rem',
  },
};

interface LandingHeaderProps {
  isLandingNavOpen: boolean;
}

export default function Header({ isLandingNavOpen }: LandingHeaderProps) {
  //This is because typescript complains about adding the seperate width as an object literal if i use
  //array of objects
  const finalTypewriterStyle: SxProps<ThemeType> = !isLandingNavOpen
    ? {
        ...typewriterBase,
        ...typewriterTextStyle,
        ...typewriterAnimation,
      }
    : {
        ...typewriterBase,
        ...typewriterTextStyle,
        width: '100%',
      };

  return (
    <Box component={'div'} className='typewriter' sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box component={'p'} className='typewriter-text' sx={finalTypewriterStyle}>
        SOMETHING IS TRYING TO ESCAPE!
      </Box>
    </Box>
  );
}
