import { Label, Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { useState } from 'react';
import { useLocation, useNavigate, useRouteError } from 'react-router';

export default function BaseError() {
  const [viewErrorStack, setViewErrorStack] = useState<boolean>(false);
  const nav = useNavigate();
  const error = useRouteError() as Error;
  const { pathname } = useLocation();

  return (
    <Container
      component={'div'}
      id={`${pathname}-error-wrapper`}
      key={`${pathname}-error-wrapper`}
      sx={{ display: 'flex', flexFlow: 'wrap', gap: 4 }}
    >
      <Box
        component={'section'}
        id={`${pathname}-error-title-box`}
        key={`${pathname}-error-title-box`}
        flex={'1 0 100%'}
      >
        <Text
          id={`${pathname}-error-message-title`}
          component={'h1'}
          titleVariant="h1"
          titleText={'Sorry, We Experienced an Error'}
          sx={{ textAlign: 'center' }}
        />
      </Box>
      <Box
        component={'section'}
        id={`${pathname}-error-box`}
        key={`${pathname}-error-box`}
        sx={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Text
          id={`${pathname}-error-message-header`}
          component={'h3'}
          titleVariant="h3"
          titleText={`Click the button below if you would like to see the details of the error`}
          sx={{}}
        />
        <Box component={'section'} id={`${pathname}-error-details-box`} key={`${pathname}-error-details-box`}>
          <Text
            id={`${pathname}-error-message-name`}
            key={`${pathname}-error-message-name`}
            component={'p'}
            titleVariant="body1"
            titleText={
              <pre>
                <strong>{`Error Name:\n`}</strong>
                {`${error.name}`}
              </pre>
            }
            sx={{}}
          />
          <Text
            id={`${pathname}-error-message-message`}
            key={`${pathname}-error-message-message`}
            component={'p'}
            titleVariant="body1"
            titleText={
              <pre>
                <strong>{`Error Message:\n`}</strong>
                {`${error.message}`}
              </pre>
            }
          />
          {error.stack && (
            <Button
              LinkComponent={'button'}
              id={`${pathname}-error-view-stacktrace-button`}
              key={`${pathname}-error-view-stacktrace-button`}
              variant="contained"
              color="error"
              onClick={() => setViewErrorStack(!viewErrorStack)}
              sx={{}}
            >
              <Label
                id="error-stacktrace-label"
                tooltipTitle={`Click to view stacktrace for ${error.name}`}
                labelVariant={'button'}
                labelText={viewErrorStack ? 'Close' : 'View Error Stack-Trace'}
                placement={'top'}
                htmlFor={`${pathname}-error-view-stacktrace-button`}
                tooltipSx={{}}
                labelTextSx={{}}
                labelWrapperDivSxProps={{}}
              />
            </Button>
          )}
          {viewErrorStack && error.stack && (
            <Text
              id={`${pathname}-error-stacktrace`}
              key={`${pathname}-error-stacktrace`}
              component={'p'}
              titleVariant="body1"
              titleText={
                <pre>
                  <strong>{`Error Stacktrace:\n`}</strong>
                  {error.stack}
                </pre>
              }
              sx={{}}
            />
          )}
        </Box>
      </Box>
      <Box
        component={'section'}
        id={`${pathname}-error-home-button-box`}
        key={`${pathname}-error-home-button-box`}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Text
          id={`${pathname}-error-home-button-text`}
          titleVariant={'h3'}
          titleText={'Return to Home Screen'}
          component={'h3'}
          sx={{ textAlign: 'center' }}
        />
        <Button
          LinkComponent={'button'}
          variant="contained"
          color="primary"
          id={`${pathname}-error-home-button`}
          key={`${pathname}-error-home-button`}
          onClick={() => nav('/')}
          sx={{}}
        >
          <Label
            id={`${pathname}-error-label`}
            tooltipTitle={'Click to return to the homepage'}
            labelVariant={'button'}
            labelText={'Home'}
            placement={'top'}
            htmlFor={`${pathname}-error-home-button`}
            tooltipSx={{}}
            labelTextSx={{ fontSize: '2rem' }}
            labelWrapperDivSxProps={{}}
          />
        </Button>
      </Box>
    </Container>
  );
}
