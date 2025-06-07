import Box, { type BoxProps } from '@mui/material/Box';
import type { CSSProperties } from '@mui/material/styles';
import MenuIcon from '../../components/icons/menu_icon';
import Theme from '../../styles/theme';

const typewriterStyle: CSSProperties = {
  overflow: 'hidden',
  fontFamily: 'Landing',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  // alignSelf: 'center',
  width: 0,
};

const typewriterAnimation: CSSProperties = {
  animation: 'typewriter 4s steps(55) forwards',
};

const shakeIconAnimation: CSSProperties = {
  animation: 'shake 2.25s 5',
  animationDelay: '3.5s',
};

const typewriterTextStyle: CSSProperties = {
  fontSize: Theme.containerQueries.down('lg') ? '3rem' : '5rem',
  m: 0,
};

interface LandingPageProps extends BoxProps {
  isOpen: boolean;
  onHandleNavbarClick: () => void;
}

export default function LandingPage({ isOpen, onHandleNavbarClick, ...props }: LandingPageProps) {
  return (
    <Box {...props}>
      <Box
        component={'div'}
        className='typewriter'
        sx={!isOpen ? { ...typewriterStyle, ...typewriterAnimation } : { ...typewriterStyle, width: '100%' }}
      >
        <Box
          component={'p'}
          className='typewriter-text'
          sx={
            !isOpen
              ? {
                  ...typewriterTextStyle,
                  ...typewriterStyle,
                  ...typewriterAnimation,
                }
              : { ...typewriterStyle, ...typewriterTextStyle, width: '100%' }
          }
        >
          SOMETHING IS TRYING TO ESCAPE!
        </Box>
      </Box>

      <Box sx={{ display: 'flex', border: '3px solid red' }}>
        <MenuIcon
          id='open-menu'
          isOpen={isOpen}
          onClick={() => onHandleNavbarClick()}
          style={!isOpen ? { ...shakeIconAnimation } : {}}
        />
        {isOpen && <div>NEXT ITEM</div>}
      </Box>
    </Box>
  );
}
