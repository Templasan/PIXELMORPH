export type ProjectStatus = 'active' | 'archived';

export function isValidProjectStatus(value: unknown): value is ProjectStatus {
  return value === 'active' || value === 'archived';
}

export function validateProjectStatus(value: unknown): ProjectStatus {
  if (!isValidProjectStatus(value)) {
    throw new Error(`Invalid ProjectStatus: ${value}. Expected 'active' or 'archived'.`);
  }
  return value;
}
