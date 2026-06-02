import { errAsync, okAsync, type Result, type ResultAsync } from "neverthrow";

/** Lift a synchronous {@link Result} into a {@link ResultAsync} of the same arms. */
export function toAsync<T, E>(r: Result<T, E>): ResultAsync<T, E> {
  return r.match(
    (value): ResultAsync<T, E> => okAsync(value),
    (error): ResultAsync<T, E> => errAsync(error),
  );
}
