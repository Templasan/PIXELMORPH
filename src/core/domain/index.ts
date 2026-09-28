/** Base entity with id and timestamp tracking. */
export abstract class BaseEntity {
  constructor(
    readonly id: string,
    readonly createdAt: number = Date.now(),
    readonly updatedAt: number = Date.now()
  ) {}
}

/** Unique identifier types for type safety. */
export type UUID = string & { readonly __brand: 'UUID' };

/** Create branded UUID type. */
export function createUUID(value: string): UUID {
  return value as UUID;
}

/** Common error types for domain layer. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string = 'DOMAIN_ERROR'
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entityType: string, id: string) {
    super(`${entityType} with id '${id}' not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
