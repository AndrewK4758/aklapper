import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import { typewriter } from '../../styles/base/animations';

interface TypewriterTextProps {
  isLandingNavOpen: boolean;
}

const TypewriterText = styled(Box, { shouldForwardProp: prop => prop !== 'isLandingNavOpen' })<TypewriterTextProps>(
  ({ theme }) => ({
    display: 'flex',
    overflowX: 'hidden',
    fontFamily: 'Orange Gummy',
    whiteSpace: 'nowrap',
    justifyContent: 'flex-start',
    width: 0,
    marginLeft: '1.5em',
    padding: 0,
    fontSize: '6rem',
    [theme.breakpoints.up('xl')]: {
      fontSize: '5rem',
    },
    [theme.breakpoints.down('lg')]: {
      fontSize: '3rem',
    },
    [theme.breakpoints.down('md')]: {
      textWrap: 'balance',
      lineHeight: '2rem',
      fontSize: '2rem',
      height: '6rem',
    },
    variants: [
      {
        props: { isLandingNavOpen: false },
        style: {
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
  return <TypewriterText isLandingNavOpen={isLandingNavOpen}>SOMETHING IS TRYING TO ESCAPE!</TypewriterText>;
}
