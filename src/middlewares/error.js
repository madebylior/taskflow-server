import { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } from 'sequelize';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
}

// Express recognizes error handlers by their four parameters.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Unexpected server error';

  if (err instanceof ApiError) {
    status = err.status; code = err.code; message = err.message;
  } else if (err instanceof UniqueConstraintError) {
    status = 409; code = 'DUPLICATE'; message = 'A record with these values already exists';
  } else if (err instanceof ValidationError) {
    status = 400; code = 'VALIDATION_ERROR'; message = err.errors.map((item) => item.message).join('; ');
  } else if (err instanceof ForeignKeyConstraintError) {
    status = 400; code = 'INVALID_REFERENCE'; message = 'Referenced record does not exist';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Malformed JSON body';
  } else if (err.status === 413) {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body too large';
  }
  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(err);
  res.status(status).json({ success: false, error: { code, message } });
}
