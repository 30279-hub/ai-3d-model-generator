export class HttpError extends Error {
  constructor(statusCode, message, publicMessage = message) {
    super(message);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}
