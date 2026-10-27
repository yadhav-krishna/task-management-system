function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  let status = error.status || 500;
  let message = error.message || 'An unexpected server error occurred.';

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    status = 400;
    message = 'Request body must contain valid JSON.';
  } else if (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'StrictModeError') {
    status = 400;
    message = error.message;
  } else if (error.code === 11000) {
    status = 409;
    message = 'A task with that unique value already exists.';
  }

  if (status >= 500) {
    console.error('Request failed:', error.message);
    message = 'The server could not complete the request. Check the server logs and database connection.';
  }
  res.status(status).json({ success: false, error: { message } });
}

module.exports = { notFound, errorHandler };
