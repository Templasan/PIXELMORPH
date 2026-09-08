import { Project, MediaAsset } from '../../domain';
import { ProjectPersistenceDTO, MediaAssetDTO, validateProjectPersistenceDTO } from '../dtos';
import { DataCorruptionError } from '../../ports';

export class ProjectMapper {
  static toPersistence(project: Project): ProjectPersistenceDTO {
    return {
      version: 1,
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      assets: project.assets.map((asset) => this.assetToPersistence(asset)),
      thumbnailUri: project.thumbnailUri,
    };
  }

  static toDomain(dto: ProjectPersistenceDTO): Project {
    if (!validateProjectPersistenceDTO(dto)) {
      throw new DataCorruptionError('Invalid ProjectPersistenceDTO structure');
    }

    let createdAt: Date;
    let updatedAt: Date;

    try {
      createdAt = new Date(dto.createdAt);
      updatedAt = new Date(dto.updatedAt);

      if (Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
        throw new Error('Invalid dates');
      }
    } catch {
      throw new DataCorruptionError('Invalid or unparseable date fields');
    }

    const assets = dto.assets.map((assetDto) => this.assetToDomain(assetDto));

    return {
      id: dto.id,
      name: dto.name,
      type: dto.type,
      status: dto.status,
      createdAt,
      updatedAt,
      assets,
      thumbnailUri: dto.thumbnailUri,
    };
  }

  private static assetToPersistence(asset: MediaAsset): MediaAssetDTO {
    return {
      id: asset.id,
      type: asset.type,
      originalUri: asset.originalUri,
      workingUri: asset.workingUri,
      metadata: asset.metadata,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  private static assetToDomain(dto: MediaAssetDTO): MediaAsset {
    let createdAt: Date;
    let updatedAt: Date;

    try {
      createdAt = new Date(dto.createdAt);
      updatedAt = new Date(dto.updatedAt);

      if (Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
        throw new Error('Invalid dates');
      }
    } catch {
      throw new DataCorruptionError('Invalid or unparseable asset date fields');
    }

    return {
      id: dto.id,
      type: dto.type,
      originalUri: dto.originalUri,
      workingUri: dto.workingUri,
      metadata: dto.metadata,
      createdAt,
      updatedAt,
    };
  }
}
