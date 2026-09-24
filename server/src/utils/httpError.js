/** An error that maps directly to an HTTP response. Thrown from controllers and middleware. */
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, fields);
export const unauthorized = (message = 'Please log in to continue.') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do that.') => new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
