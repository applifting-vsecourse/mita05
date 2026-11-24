/**
 * A request that takes no body. With the controller's
 * `forbidNonWhitelisted`, any field sent (say a `userId`) answers 400 instead
 * of being silently ignored: who acts always comes from the session.
 */
export class EmptyBodyDto {}
