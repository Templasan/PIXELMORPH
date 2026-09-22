import { createProject, addAssetToProject, updateProject } from './Project';
import { createMediaAsset, createMediaMetadata } from '../../index';

const genId = () => `proj_${Math.random().toString(36).substr(2, 9)}`;

describe('Project Domain Entity', () => {
  describe('createProject', () => {
    it('should create a valid project', () => {
      const project = createProject(genId(), 'My Project', 'photo');
      expect(project.name).toBe('My Project');
      expect(project.type).toBe('photo');
      expect(project.assets).toEqual([]);
      expect(project.status).toBe('active');
      expect(project.thumbnailUri).toBeUndefined();
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('should create projects with both types', () => {
      const photo = createProject(genId(), 'Photo', 'photo');
      const video = createProject(genId(), 'Video', 'video');
      expect(photo.type).toBe('photo');
      expect(video.type).toBe('video');
    });

    it('should create project with unique ID', () => {
      const p1 = createProject(genId(), 'P1', 'photo');
      const p2 = createProject(genId(), 'P2', 'photo');
      expect(p1.id).not.toBe(p2.id);
    });

    it('should reject empty name', () => {
      expect(() => createProject(genId(), '', 'photo')).toThrow();
    });

    it('should create project with very long name', () => {
      const longName = 'A'.repeat(500);
      const project = createProject(genId(), longName, 'photo');
      expect(project.name).toBe(longName);
    });

    it('should set default priority and dueDate', () => {
      const project = createProject(genId(), 'Test', 'photo');
      expect(project.priority).toBeUndefined();
      expect(project.dueDate).toBeUndefined();
    });
  });

  describe('addAssetToProject', () => {
    it('should add asset to project', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const asset = createMediaAsset('a1', 'image', 'uri1', 'uri1', createMediaMetadata('image/png'));

      const updated = addAssetToProject(project, asset);
      expect(updated.assets).toHaveLength(1);
      expect(updated.assets[0].id).toBe('a1');
    });

    it('should maintain immutability', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const asset = createMediaAsset('a1', 'image', 'uri1', 'uri1', createMediaMetadata('image/png'));

      const updated = addAssetToProject(project, asset);
      expect(project.assets).toHaveLength(0);
      expect(updated.assets).toHaveLength(1);
    });

    it('should add multiple assets in sequence', () => {
      let project = createProject(genId(), 'Test', 'photo');
      const a1 = createMediaAsset('a1', 'image', 'uri1', 'uri1', createMediaMetadata('image/png'));
      const a2 = createMediaAsset('a2', 'image', 'uri2', 'uri2', createMediaMetadata('image/jpg'));

      project = addAssetToProject(project, a1);
      project = addAssetToProject(project, a2);

      expect(project.assets).toHaveLength(2);
      expect(project.assets[0].id).toBe('a1');
      expect(project.assets[1].id).toBe('a2');
    });

    it('should reject duplicate asset IDs', () => {
      let project = createProject(genId(), 'Test', 'photo');
      const a1 = createMediaAsset('a1', 'image', 'uri1', 'uri1', createMediaMetadata('image/png'));
      const a2 = createMediaAsset('a1', 'image', 'uri2', 'uri2', createMediaMetadata('image/jpg'));

      project = addAssetToProject(project, a1);
      expect(() => addAssetToProject(project, a2)).toThrow();
    });

    it('should update timestamp on asset add', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const originalTime = project.updatedAt.getTime();

      const asset = createMediaAsset('a1', 'image', 'uri1', 'uri1', createMediaMetadata('image/png'));
      const updated = addAssetToProject(project, asset);

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime);
    });
  });

  describe('updateProject', () => {
    it('should update name', () => {
      const project = createProject(genId(), 'Old Name', 'photo');
      const updated = updateProject(project, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should update priority', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const updated = updateProject(project, { priority: 'high' });
      expect(updated.priority).toBe('high');
    });

    it('should update dueDate', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const dueDate = new Date('2025-12-31');
      const updated = updateProject(project, { dueDate });
      expect(updated.dueDate).toEqual(dueDate);
    });

    it('should clear dueDate', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const withDate = updateProject(project, { dueDate: new Date() });
      const withoutDate = updateProject(withDate, { dueDate: undefined });
      expect(withoutDate.dueDate).toBeUndefined();
    });

    it('should not update immutable fields', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const updated = updateProject(project, { name: 'New' });
      expect(updated.id).toBe(project.id);
      expect(updated.type).toBe(project.type);
      expect(updated.status).toBe(project.status);
    });

    it('should update partial fields', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const updated = updateProject(project, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
      expect(updated.priority).toBeUndefined();
    });

    it('should update timestamp', () => {
      const project = createProject(genId(), 'Test', 'photo');
      const originalTime = project.updatedAt.getTime();
      const updated = updateProject(project, { name: 'New' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime);
    });

    it('should reject invalid priority', () => {
      const project = createProject(genId(), 'Test', 'photo');
      expect(() => {
        updateProject(project, { priority: 'invalid' as any });
      }).toThrow();
    });
  });

  describe('Project invariants', () => {
    it('should always have valid type', () => {
      const photo = createProject(genId(), 'Test', 'photo');
      const video = createProject(genId(), 'Test', 'video');
      expect(['photo', 'video']).toContain(photo.type);
      expect(['photo', 'video']).toContain(video.type);
    });

    it('should always have status active on creation', () => {
      const project = createProject(genId(), 'Test', 'photo');
      expect(project.status).toBe('active');
    });

    it('should have createdAt before updatedAt', () => {
      const project = createProject(genId(), 'Test', 'photo');
      expect(project.createdAt.getTime()).toBeLessThanOrEqual(project.updatedAt.getTime());
    });
  });
});
