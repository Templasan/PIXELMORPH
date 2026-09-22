import { DomainError } from '../domain';

/** Base interface for all use case results. */
export interface UseCaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Base class for all use cases. */
export abstract class UseCase<TInput, TOutput> {
  abstract execute(input: TInput): Promise<UseCaseResult<TOutput>>;

  protected success<T>(data: T): UseCaseResult<T> {
    return { success: true, data };
  }

  protected failure(error: unknown): UseCaseResult<never> {
    const message =
      error instanceof DomainError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    return { success: false, error: message };
  }
}

/** Base data transfer object. */
export interface DTO {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}
