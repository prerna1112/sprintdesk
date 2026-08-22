export type AuthenticatedFetchErrorCode =
  | 'session_changed'
  | 'session_expired'
  | 'no_session'
  | 'request_not_replayable';

export class AuthenticatedFetchError extends Error {
  readonly code: AuthenticatedFetchErrorCode;

  constructor(
    message: string,
    options: ErrorOptions & { code?: AuthenticatedFetchErrorCode } = {},
  ) {
    super(message, options);
    this.name = 'AuthenticatedFetchError';
    this.code = options.code ?? 'session_expired';
  }
}

export function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createAbortError();
}
