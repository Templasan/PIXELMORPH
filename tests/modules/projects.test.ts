import {
  createProject,
  createMediaAsset,
  createMediaMetadata,
  addAssetToProject,
  removeAssetFromProject,
  updateProject,
  validateProject,
  validateMediaAsset,
} from '@modules/projects/domain';

describe('Projects Module — Domain Layer', () => {
  describe('MediaMetadata', () => {
    it('should create valid media metadata', () => {
      const metadata = createMediaMetadata('image/jpeg', {
        width: 1920,
        height: 1080,
        fileSizeBytes: 512000,
      });

      expect(metadata.mimeType).toBe('image/jpeg');
      expect(metadata.width).toBe(1920);
      expect(metadata.height).toBe(1080);
      expect(metadata.fileSizeBytes).toBe(512000);
    });

    it('should reject invalid mimeType', () => {
      expect(() => createMediaMetadata('')).toThrow();
      expect(() => createMediaMetadata(null as any)).toThrow();
    });

    it('should handle optional fields', () => {
      const metadata = createMediaMetadata('audio/mp3');
      expect(metadata.durationMs).toBeUndefined();
      expect(metadata.width).toBeUndefined();
    });
  });

  describe('MediaAsset', () => {
    it('should create valid media asset', () => {
      const metadata = createMediaMetadata('image/jpeg');
      const asset = createMediaAsset(
        'asset-1',
        'image',
        '/path/original.jpg',
        '/path/working.jpg',
        metadata
      );

      expect(asset.id).toBe('asset-1');
      expect(asset.type).toBe('image');
      expect(asset.originalUri).toBe('/path/original.jpg');
      expect(asset.workingUri).toBe('/path/working.jpg');
      expect(asset.createdAt).toBeInstanceOf(Date);
      expect(asset.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid asset data', () => {
      const metadata = createMediaMetadata('image/jpeg');

      expect(() => createMediaAsset('', 'image', '/original', '/working', metadata)).toThrow();
      expect(() => createMediaAsset('asset-1', 'image' as any, '', '/working', metadata)).toThrow();
      expect(() => createMediaAsset('asset-1', 'image', '/original', '', metadata)).toThrow();
    });

    it('should not allow duplicate asset IDs in project', () => {
      const metadata = createMediaMetadata('image/jpeg');
      const asset = createMediaAsset('asset-1', 'image', '/original.jpg', '/working.jpg', metadata);
      const project = createProject('proj-1', 'My Project', 'photo');

      const proj1 = addAssetToProject(project, asset);
      expect(() => addAssetToProject(proj1, asset)).toThrow(/already exists/);
    });

    it('should validate media asset correctly', () => {
      const metadata = createMediaMetadata('image/jpeg');
      const asset = createMediaAsset('asset-1', 'image', '/original.jpg', '/working.jpg', metadata);

      expect(validateMediaAsset(asset)).toBe(true);
      expect(validateMediaAsset({ ...asset, id: '' })).toBe(false);
      expect(validateMediaAsset({ ...asset, createdAt: 'not-a-date' })).toBe(false);
    });
  });

  describe('Project Aggregate', () => {
    it('should create valid project', () => {
      const project = createProject('proj-1', 'Summer Vacation', 'photo');

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('Summer Vacation');
      expect(project.type).toBe('photo');
      expect(project.status).toBe('active');
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
      expect(project.assets).toEqual([]);
    });

    it('should reject invalid project data', () => {
      expect(() => createProject('', 'Name', 'photo')).toThrow();
      expect(() => createProject('proj-1', '', 'photo')).toThrow();
      expect(() => createProject('proj-1', 'Name', 'invalid' as any)).toThrow();
    });

    it('should add assets to project', () => {
      const project = createProject('proj-1', 'Project', 'photo');
      const metadata = createMediaMetadata('image/jpeg');
      const asset = createMediaAsset('asset-1', 'image', '/orig', '/work', metadata);

      const updated = addAssetToProject(project, asset);

      expect(updated.assets.length).toBe(1);
      expect(updated.assets[0].id).toBe('asset-1');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(project.updatedAt.getTime());
    });

    it('should remove assets from project', () => {
      const project = createProject('proj-1', 'Project', 'photo');
      const metadata = createMediaMetadata('image/jpeg');
      const asset1 = createMediaAsset('asset-1', 'image', '/orig1', '/work1', metadata);
      const asset2 = createMediaAsset('asset-2', 'image', '/orig2', '/work2', metadata);

      let updated = addAssetToProject(project, asset1);
      updated = addAssetToProject(updated, asset2);
      expect(updated.assets.length).toBe(2);

      updated = removeAssetFromProject(updated, 'asset-1');
      expect(updated.assets.length).toBe(1);
      expect(updated.assets[0].id).toBe('asset-2');
    });

    it('should reject removal of nonexistent asset', () => {
      const project = createProject('proj-1', 'Project', 'photo');
      expect(() => removeAssetFromProject(project, 'nonexistent')).toThrow(/not found/);
    });

    it('should update project fields', () => {
      const project = createProject('proj-1', 'Original Name', 'photo');
      const updated = updateProject(project, { name: 'New Name' });

      expect(updated.name).toBe('New Name');
      expect(updated.type).toBe('photo');
      expect(updated.id).toBe('proj-1');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(project.updatedAt.getTime());
    });

    it('should support multiple media types', () => {
      const project = createProject('proj-1', 'Mixed Project', 'mixed');
      const imageMetadata = createMediaMetadata('image/jpeg');
      const videoMetadata = createMediaMetadata('video/mp4', { durationMs: 30000 });

      const image = createMediaAsset('img-1', 'image', '/orig1', '/work1', imageMetadata);
      const video = createMediaAsset('vid-1', 'video', '/orig2', '/work2', videoMetadata);

      let updated = addAssetToProject(project, image);
      updated = addAssetToProject(updated, video);

      expect(updated.assets.length).toBe(2);
      expect(updated.assets[0].type).toBe('image');
      expect(updated.assets[1].type).toBe('video');
    });

    it('should validate project correctly', () => {
      const project = createProject('proj-1', 'Test Project', 'photo');

      expect(validateProject(project)).toBe(true);
      expect(validateProject({ ...project, id: '' })).toBe(false);
      expect(validateProject({ ...project, status: 'invalid' })).toBe(false);
    });

    it('should preserve createdAt timestamp', () => {
      const project = createProject('proj-1', 'Project', 'photo');
      const originalCreatedAt = project.createdAt;

      const updated = updateProject(project, { name: 'Updated Name' });

      expect(updated.createdAt).toEqual(originalCreatedAt);
    });

    it('should handle empty projects', () => {
      const project = createProject('proj-1', 'Empty Project', 'photo');

      expect(project.assets).toHaveLength(0);
      expect(validateProject(project)).toBe(true);
    });
  });

  describe('Type Validations', () => {
    it('should only allow valid ProjectTypes', () => {
      expect(() => createProject('proj-1', 'Name', 'photo')).not.toThrow();
      expect(() => createProject('proj-1', 'Name', 'video')).not.toThrow();
      expect(() => createProject('proj-1', 'Name', 'mixed')).not.toThrow();
      expect(() => createProject('proj-1', 'Name', 'invalid' as any)).toThrow();
    });

    it('should only allow valid ProjectStatus', () => {
      const project = createProject('proj-1', 'Name', 'photo');
      expect(project.status).toBe('active');

      const archived = updateProject(project, { status: 'archived' });
      expect(archived.status).toBe('archived');

      expect(() => updateProject(project, { status: 'invalid' as any })).toThrow();
    });

    it('should only allow valid MediaTypes', () => {
      const metadata = createMediaMetadata('image/jpeg');
      expect(() => createMediaAsset('a-1', 'image', '/o', '/w', metadata)).not.toThrow();
      expect(() => createMediaAsset('a-2', 'video', '/o', '/w', metadata)).not.toThrow();
      expect(() => createMediaAsset('a-3', 'audio', '/o', '/w', metadata)).not.toThrow();
      expect(() => createMediaAsset('a-4', 'unknown', '/o', '/w', metadata)).not.toThrow();
      expect(() => createMediaAsset('a-5', 'invalid' as any, '/o', '/w', metadata)).toThrow();
    });
  });
});

describe('Projects Module — Timestamps', () => {
  it('should set timestamps at creation', () => {
    const project = createProject('proj-1', 'Project', 'photo');
    const now = new Date();

    expect(project.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(project.updatedAt.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('should update updatedAt on modifications', () => {
    const project = createProject('proj-1', 'Project', 'photo');
    const originalUpdatedAt = project.updatedAt;

    // Wait a tiny bit to ensure time difference
    const updated = updateProject(project, { name: 'Updated' });

    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });

  it('should preserve timestamps on asset addition', () => {
    const project = createProject('proj-1', 'Project', 'photo');
    const originalCreatedAt = project.createdAt;

    const metadata = createMediaMetadata('image/jpeg');
    const asset = createMediaAsset('asset-1', 'image', '/orig', '/work', metadata);
    const updated = addAssetToProject(project, asset);

    expect(updated.createdAt).toEqual(originalCreatedAt);
  });
});
