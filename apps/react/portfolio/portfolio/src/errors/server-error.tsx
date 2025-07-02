import { Label, Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Theme from '../styles/themes/theme.js';

interface ServerErrorProps {
  error: Error;
}

export default function ServerError({ error }: ServerErrorProps) {
  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      <Container id='server-error-container'>
        <Box id={`error-title-box`} flex={'1 0 100%'}>
          <Text
            id={`error-message-title`}
            variant='h1'
            children={'Sorry, We Experienced an Error'}
            sx={{ textAlign: 'center' }}
          />
        </Box>
        <Box id={`error-box`} sx={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text
            id={`error-message-header`}
            variant='h3'
            children={`Click the button below if you would like to see the details of the error`}
            sx={{}}
          />
          <Box id={`error-details-box`}>
            <Text
              id={`error-message-name`}
              variant='body1'
              children={
                <pre>
                  <strong>{`Error Name:\n`}</strong>
                  {`${error.name}`}
                </pre>
              }
              sx={{}}
            />
            <Text
              id={`error-message-message`}
              variant='body1'
              children={
                <pre>
                  <strong>{`Error Message:\n`}</strong>
                  {`${error.message}`}
                </pre>
              }
            />

            <Text
              id={`error-stacktrace`}
              key={`error-stacktrace`}
              variant='body1'
              children={
                <pre>
                  <strong>{`Error Stacktrace:\n`}</strong>
                  {error.stack}
                </pre>
              }
              sx={{}}
            />
          </Box>
        </Box>
        <Box id={`error-home-button-box`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text
            id={`error-home-button-text`}
            variant={'h3'}
            children={'Return to Home Screen'}
            sx={{ textAlign: 'center' }}
          />
          <Button
            LinkComponent={'button'}
            variant='contained'
            color='primary'
            id={`error-home-button`}
            onClick={() => {
              if (typeof window !== 'undefined') window.location.replace('http://localhost:4700');
            }}
          >
            <Label
              id='error-home-button-label'
              tooltipTitle={'Click to return to the homepage'}
              labelVariant={'button'}
              labelText={'Home'}
              placement={'top'}
              htmlFor={`error-home-button`}
              labelTextSx={{ fontSize: '2rem' }}
              labelWrapperDivSxProps={{}}
            />
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
}
