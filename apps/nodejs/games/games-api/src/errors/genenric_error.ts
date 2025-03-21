interface GenericError extends Error {
  clientErrorMessage: string;
  stacktrace: Error['stack'];
  message: Error['message'];
  cause: Error['cause'];
  name: Error['name'];
}

const error = (message: string, error: Error): GenericError => ({
  clientErrorMessage: message,
  stacktrace: error.stack,
  message: error.message,
  cause: error.cause,
  name: error.name
});

export default error;
