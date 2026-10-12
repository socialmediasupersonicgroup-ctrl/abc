/** An error whose message is safe to show to the user. Anything else is reported generically. */
export class AppError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found. It may have been deleted.`);
    this.name = "NotFoundError";
  }
}
