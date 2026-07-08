export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new TimeoutError(
              label
                ? `Operation "${label}" timed out after ${timeoutMs}ms`
                : `Operation timed out after ${timeoutMs}ms`,
            ),
          ),
        timeoutMs,
      );
    }),
  ]);
}

export function createAbortWithTimeout(
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; controller: AbortController } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}
