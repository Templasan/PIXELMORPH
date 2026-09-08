export type ProjectType = 'photo' | 'video' | 'mixed';

export function isValidProjectType(value: unknown): value is ProjectType {
  return value === 'photo' || value === 'video' || value === 'mixed';
}

export function validateProjectType(value: unknown): ProjectType {
  if (!isValidProjectType(value)) {
    throw new Error(`Invalid ProjectType: ${value}. Expected 'photo', 'video', or 'mixed'.`);
  }
  return value;
}
