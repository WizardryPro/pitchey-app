import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

import { characterService } from '../character.service';

const mockCharacter = {
  id: '1',
  name: 'Alice',
  description: 'The protagonist',
  age: '30',
  gender: 'female',
  actor: 'Jane Doe',
  role: 'lead',
  relationship: 'hero',
  displayOrder: 0,
};

describe('characterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getCharacters ───────────────────────────────────────────────
  describe('getCharacters', () => {
    it('returns characters array on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { characters: [mockCharacter] } });

      const result = await characterService.getCharacters(42);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/42/characters');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    it('returns empty array when API returns no characters', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      const result = await characterService.getCharacters(1);

      expect(result).toEqual([]);
    });

    it('throws when API returns failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Pitch not found' } });

      await expect(characterService.getCharacters(99)).rejects.toThrow('Pitch not found');
    });

    it('throws when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(characterService.getCharacters(1)).rejects.toThrow('Network error');
    });
  });

  // ─── addCharacter ────────────────────────────────────────────────
  describe('addCharacter', () => {
    it('posts character and returns created character', async () => {
      mockPost.mockResolvedValue({ success: true, data: { character: mockCharacter } });

      const newChar = { name: 'Alice', description: 'Protagonist', age: '30', gender: 'female', actor: 'Jane', role: 'lead', relationship: 'hero' };
      const result = await characterService.addCharacter(42, newChar);

      expect(mockPost).toHaveBeenCalledWith('/api/pitches/42/characters', newChar);
      expect(result.name).toBe('Alice');
    });

    it('throws when API fails', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Validation error' } });

      await expect(
        characterService.addCharacter(1, { name: 'Bad', description: '', gender: 'unknown', role: 'extra', relationship: '' })
      ).rejects.toThrow('Validation error');
    });

    it('throws when no character in response', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });

      await expect(
        characterService.addCharacter(1, { name: 'Alice', description: '', gender: 'female', role: 'lead', relationship: '' })
      ).rejects.toThrow('No character returned from server');
    });

    it('throws when API throws', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(
        characterService.addCharacter(1, { name: 'Alice', description: '', gender: 'female', role: 'lead', relationship: '' })
      ).rejects.toThrow('Network error');
    });
  });

  // ─── updateCharacter ─────────────────────────────────────────────
  describe('updateCharacter', () => {
    it('puts character update and returns updated character', async () => {
      const updatedChar = { ...mockCharacter, name: 'Alice Updated' };
      mockPut.mockResolvedValue({ success: true, data: { character: updatedChar } });

      const updateData = { name: 'Alice Updated', description: 'Protagonist updated', gender: 'female', role: 'lead', relationship: 'hero' };
      const result = await characterService.updateCharacter(42, 1, updateData);

      expect(mockPut).toHaveBeenCalledWith('/api/pitches/42/characters/1', updateData);
      expect(result.name).toBe('Alice Updated');
    });

    it('throws when API fails', async () => {
      mockPut.mockResolvedValue({ success: false, error: { message: 'Character not found' } });

      await expect(
        characterService.updateCharacter(1, 99, { name: 'X', description: '', gender: 'other', role: 'minor', relationship: '' })
      ).rejects.toThrow('Character not found');
    });

    it('throws when no character in response', async () => {
      mockPut.mockResolvedValue({ success: true, data: {} });

      await expect(
        characterService.updateCharacter(1, 1, { name: 'Alice', description: '', gender: 'female', role: 'lead', relationship: '' })
      ).rejects.toThrow('No character returned from server');
    });
  });

  // ─── deleteCharacter ─────────────────────────────────────────────
  describe('deleteCharacter', () => {
    it('calls delete on correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true, data: {} });

      await characterService.deleteCharacter(42, 1);

      expect(mockDelete).toHaveBeenCalledWith('/api/pitches/42/characters/1');
    });

    it('throws when API fails', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(characterService.deleteCharacter(1, 99)).rejects.toThrow('Not found');
    });

    it('throws when API throws', async () => {
      mockDelete.mockRejectedValue(new Error('Network error'));

      await expect(characterService.deleteCharacter(1, 1)).rejects.toThrow('Network error');
    });
  });

  // ─── reorderCharacters ───────────────────────────────────────────
  describe('reorderCharacters', () => {
    it('posts reorder request and returns characters', async () => {
      const chars = [mockCharacter];
      mockPost.mockResolvedValue({ success: true, data: { characters: chars } });

      const orders = [{ id: 1, displayOrder: 0 }];
      const result = await characterService.reorderCharacters(42, orders);

      expect(mockPost).toHaveBeenCalledWith('/api/pitches/42/characters/reorder', {
        characterOrders: orders,
      });
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no characters in response', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });

      const result = await characterService.reorderCharacters(1, []);

      expect(result).toEqual([]);
    });

    it('throws when API fails', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Reorder failed' } });

      await expect(characterService.reorderCharacters(1, [{ id: 1, displayOrder: 0 }])).rejects.toThrow('Reorder failed');
    });
  });

  // ─── moveCharacter ───────────────────────────────────────────────
  describe('moveCharacter', () => {
    it('patches position and returns characters', async () => {
      mockPatch.mockResolvedValue({ success: true, data: { characters: [mockCharacter] } });

      const result = await characterService.moveCharacter(42, 1, 'up');

      expect(mockPatch).toHaveBeenCalledWith('/api/pitches/42/characters/1/position', { direction: 'up' });
      expect(result).toHaveLength(1);
    });

    it('patches with direction "down"', async () => {
      mockPatch.mockResolvedValue({ success: true, data: { characters: [] } });

      await characterService.moveCharacter(42, 1, 'down');

      expect(mockPatch).toHaveBeenCalledWith('/api/pitches/42/characters/1/position', { direction: 'down' });
    });

    it('throws when API fails', async () => {
      mockPatch.mockResolvedValue({ success: false, error: { message: 'Move failed' } });

      await expect(characterService.moveCharacter(1, 1, 'up')).rejects.toThrow('Move failed');
    });
  });

  // ─── batchUpdateCharacters ───────────────────────────────────────
  describe('batchUpdateCharacters', () => {
    it('executes delete, update, add, and reorder operations in sequence', async () => {
      // Setup: getCharacters returns a list
      mockGet.mockResolvedValue({ success: true, data: { characters: [mockCharacter] } });
      // delete
      mockDelete.mockResolvedValue({ success: true, data: {} });
      // update
      mockPut.mockResolvedValue({ success: true, data: { character: mockCharacter } });
      // add
      mockPost
        .mockResolvedValueOnce({ success: true, data: { character: mockCharacter } }) // add
        .mockResolvedValueOnce({ success: true, data: { characters: [mockCharacter] } }); // reorder

      const result = await characterService.batchUpdateCharacters(42, {
        delete: [1],
        update: [{ id: 1, character: { name: 'Updated', description: '', gender: 'female', role: 'lead', relationship: '' } }],
        add: [{ name: 'New Char', description: '', gender: 'male', role: 'supporting', relationship: '' }],
        reorder: [{ id: 1, displayOrder: 0 }],
      });

      expect(mockDelete).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('refetches characters when no reorder specified', async () => {
      mockGet
        .mockResolvedValueOnce({ success: true, data: { characters: [mockCharacter] } }) // initial
        .mockResolvedValueOnce({ success: true, data: { characters: [mockCharacter] } }); // refetch

      const result = await characterService.batchUpdateCharacters(42, {});

      // Should call getCharacters twice (once at start, once at end for refetch)
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });

    it('propagates errors from individual operations', async () => {
      mockGet.mockResolvedValue({ success: true, data: { characters: [] } });
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Delete failed' } });

      await expect(
        characterService.batchUpdateCharacters(42, { delete: [99] })
      ).rejects.toThrow('Delete failed');
    });
  });
});
