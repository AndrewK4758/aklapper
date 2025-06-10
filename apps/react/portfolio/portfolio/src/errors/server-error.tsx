import { Label, Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Theme from '../styles/theme';

interface ServerErrorProps {
  error: Error;
}

export default function ServerError({ error }: ServerErrorProps) {
  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      <Container component={'div'} id='server-error-container'>
        <Box component={'section'} id={`error-title-box`} key={`error-title-box`} flex={'1 0 100%'}>
          <Text
            id={`error-message-title`}
            component={'h1'}
            variant='h1'
            children={'Sorry, We Experienced an Error'}
            sx={{ textAlign: 'center' }}
          />
        </Box>
        <Box
          component={'section'}
          id={`error-box`}
          key={`error-box`}
          sx={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Text
            id={`error-message-header`}
            component={'h3'}
            variant='h3'
            children={`Click the button below if you would like to see the details of the error`}
            sx={{}}
          />
          <Box component={'section'} id={`error-details-box`} key={`error-details-box`}>
            <Text
              id={`error-message-name`}
              key={`error-message-name`}
              component={'span'}
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
              key={`error-message-message`}
              component={'span'}
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
              component={'span'}
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

        <Box
          component={'section'}
          id={`error-home-button-box`}
          key={`error-home-button-box`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Text
            id={`error-home-button-text`}
            variant={'h3'}
            children={'Return to Home Screen'}
            component={'h3'}
            sx={{ textAlign: 'center' }}
          />
          <Button
            LinkComponent={'button'}
            variant='contained'
            color='primary'
            id={`error-home-button`}
            key={`error-home-button`}
            onClick={() => window.location.replace('http://localhost:4700')}
            sx={{}}
          >
            <Label
              id='error-home-button-label'
              tooltipTitle={'Click to return to the homepage'}
              labelVariant={'button'}
              labelText={'Home'}
              placement={'top'}
              htmlFor={`error-home-button`}
              tooltipSx={{}}
              labelTextSx={{ fontSize: '2rem' }}
              labelWrapperDivSxProps={{}}
            />
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
}
