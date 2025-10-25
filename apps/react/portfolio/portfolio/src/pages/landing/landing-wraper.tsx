import { StyledRootComponentWrapper } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import styles from '../../styles/landing.module.css';
import LandingPage from './landing';

export default function LandingWrapper() {
  return (
    <StyledRootComponentWrapper id='landing-root'>
      <Box className={styles.landingModule} id={'landing-svg-animations-wrapper'}>
        <LandingPage />
      </Box>
    </StyledRootComponentWrapper>
  );
}
