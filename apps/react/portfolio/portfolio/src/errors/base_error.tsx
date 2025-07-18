import { SectionTitle, Text } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import Button from '@mui/material/Button';
import { css } from '@pigment-css/react';
import { useState } from 'react';
import { useLocation, useNavigate, useRouteError } from 'react-router';

export default function BaseError() {
  const [viewErrorStack, setViewErrorStack] = useState(false);
  const nav = useNavigate();
  const error = useRouteError() as Error;
  const { pathname } = useLocation();

  return (
    <Container
      as={'div'}
      id={`${pathname}-error-wrapper`}
      className={css({ display: 'flex', flexFlow: 'wrap', gap: 4 })}
    >
      <Box as={'section'} id={`${pathname}-error-title-box`} className={css({ flex: 1 })}>
        <Text
          id={`${pathname}-error-message-title`}
          variant='h1'
          children={'Sorry, We Experienced an Error'}
          className={css({ textAlign: 'center' })}
        />
      </Box>
      <Box
        as={'section'}
        id={`${pathname}-error-box`}
        className={css({ flex: 3, display: 'flex', flexDirection: 'column', gap: 2 })}
      >
        <Text
          id={`${pathname}-error-message-header`}
          variant='h3'
          children={`Click the button below if you would like to see the details of the error`}
        />
        <Box as={'section'} id={`${pathname}-error-details-box`} key={`${pathname}-error-details-box`}>
          <Text
            id={`${pathname}-error-message-name`}
            component={'span'}
            variant='body1'
            children={
              <pre>
                <strong>{`Error Name:\n`}</strong>
                {`${error.name}`}
              </pre>
            }
          />
          <Text
            id={`${pathname}-error-message-message`}
            variant='body1'
            component={'span'}
            children={
              <pre>
                <strong>{`Error Message:\n`}</strong>
                {`${error.message}`}
              </pre>
            }
          />
          {error.stack && (
            <Button
              id={`${pathname}-error-view-stacktrace-button`}
              variant='contained'
              color='error'
              onClick={() => setViewErrorStack(!viewErrorStack)}
              sx={{}}
            >
              <SectionTitle
                id='error-stacktrace-label'
                title={viewErrorStack ? 'Close' : 'View Error Stack-Trace'}
                variant={'button'}
              />
            </Button>
          )}
          {viewErrorStack && error.stack && (
            <Text
              id={`${pathname}-error-stacktrace`}
              component={'span'}
              variant='body1'
              children={
                <pre>
                  <strong>{`Error Stacktrace:\n`}</strong>
                  {error.stack}
                </pre>
              }
            />
          )}
        </Box>
      </Box>
      <Box
        as={'section'}
        id={`${pathname}-error-home-button-box`}
        className={css({ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 })}
      >
        <Text
          id={`${pathname}-error-home-button-text`}
          variant={'h3'}
          children={'Return to Home Screen'}
          component={'h3'}
          sx={{ textAlign: 'center' }}
        />
        <Button
          variant='contained'
          color='primary'
          id={`${pathname}-error-home-button`}
          onClick={() => nav('/portfolio', { relative: 'route', replace: true })}
        >
          <SectionTitle id={`${pathname}-error-label`} title={'Home'} variant={'body1'} />
        </Button>
      </Box>
    </Container>
  );
}
