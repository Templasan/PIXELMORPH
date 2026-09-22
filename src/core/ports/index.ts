/** Logger port — abstraction for logging. */
export interface LoggerPort {
  log(message: string, level?: 'debug' | 'info' | 'warn' | 'error'): Promise<void>;
  error(message: string, error?: unknown): Promise<void>;
}

/** Storage port — abstraction for key-value storage. */
export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** Repository base port — abstraction for data persistence. */
export interface RepositoryPort<T> {
  create(entity: T): Promise<void>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  update(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Re-export domain-specific ports
export * from './PresetsRepository';
export * from './RecentAdjustmentsRepository';
export * from './WatermarkPresetsRepository';
