import { StyledRootComponentWrapper } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import LandingPage from './landing';
import Theme from '../../styles/themes/theme';

export default function LandingWrapper() {
  return (
    <StyledRootComponentWrapper id='landing-root'>
      <Box
        id={'landing-svg-animations-wrapper'}
        sx={{
          flex: 1,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          border: 'solid',
          [Theme.breakpoints.down('md')]: {
            padding: `${Theme.spacing(4)} 0 0 ${Theme.spacing(4)}`,
          },
        }}
      >
        <LandingPage />
      </Box>
    </StyledRootComponentWrapper>
  );
}
