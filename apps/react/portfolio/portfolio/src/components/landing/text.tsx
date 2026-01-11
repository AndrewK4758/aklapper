import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import styles from '@styles/landing/landing.module.css';

interface TypewriterTextProps {
  isLandingNavOpen: boolean;
}

//Pure CSS variants for styles based on state
const TypewriterText = styled(Box, { shouldForwardProp: prop => prop !== 'isLandingNavOpen' })<TypewriterTextProps>(
  () => ({
    display: 'flex',
    flex: 1,
    variants: [
      {
        props: { isLandingNavOpen: false },
        style: {
          animation: `${styles.typewriter} 4s steps(55) forwards`,
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

export default function Text({ isLandingNavOpen }: LandingHeaderProps) {
  return (
    <TypewriterText className={styles.textWrapper} isLandingNavOpen={isLandingNavOpen}>
      <Box className={styles.text}>SOMETHING IS TRYING TO ESCAPE!</Box>
    </TypewriterText>
  );
}
