import { describe, it, expect } from 'vitest';
import {
  validateCharacter,
  validateCharacters,
  generateCharacterId,
  normalizeCharacters,
  serializeCharacters,
  sortCharactersByOrder,
  reorderCharacters,
  getCharacterStats,
} from '../characterUtils';
import type { Character } from '@shared/types/character';

const validCharacter: Character = {
  id: 'char_1',
  name: 'John Doe',
  description: 'A mysterious stranger who arrives in town with a dark past.',
  age: '35',
  gender: 'Male',
  actor: 'Brad Pitt',
  displayOrder: 0,
};

// ============================================================================
// validateCharacter
// ============================================================================
describe('validateCharacter', () => {
  it('passes for valid character', () => {
    const result = validateCharacter(validCharacter);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('fails for missing name', () => {
    const result = validateCharacter({ ...validCharacter, name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('fails for too-long name', () => {
    const result = validateCharacter({ ...validCharacter, name: 'x'.repeat(101) });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toContain('100');
  });

  it('fails for missing description', () => {
    const result = validateCharacter({ ...validCharacter, description: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.description).toBeDefined();
  });

  it('fails for too-short description', () => {
    const result = validateCharacter({ ...validCharacter, description: 'Short' });
    expect(result.isValid).toBe(false);
    expect(result.errors.description).toContain('10');
  });

  it('fails for too-long description', () => {
    const result = validateCharacter({ ...validCharacter, description: 'x'.repeat(501) });
    expect(result.isValid).toBe(false);
    expect(result.errors.description).toContain('500');
  });

  it('fails for too-long age', () => {
    const result = validateCharacter({ ...validCharacter, age: 'x'.repeat(21) });
    expect(result.isValid).toBe(false);
    expect(result.errors.age).toBeDefined();
  });

  it('fails for too-long actor name', () => {
    const result = validateCharacter({ ...validCharacter, actor: 'x'.repeat(101) });
    expect(result.isValid).toBe(false);
    expect(result.errors.actor).toBeDefined();
  });

  it('passes when optional fields are empty', () => {
    const result = validateCharacter({
      ...validCharacter,
      age: '',
      actor: '',
    });
    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// validateCharacters
// ============================================================================
describe('validateCharacters', () => {
  it('passes for empty array', () => {
    const result = validateCharacters([]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for all valid characters', () => {
    const result = validateCharacters([validCharacter, { ...validCharacter, id: 'char_2' }]);
    expect(result.isValid).toBe(true);
  });

  it('collects errors from invalid characters', () => {
    const invalid = { ...validCharacter, name: '' };
    const result = validateCharacters([validCharacter, invalid]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
  });
});

// ============================================================================
// generateCharacterId
// ============================================================================
describe('generateCharacterId', () => {
  it('returns a string starting with "char_"', () => {
    const id = generateCharacterId();
    expect(id).toMatch(/^char_/);
  });

  it('returns unique IDs', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateCharacterId()));
    expect(ids.size).toBe(10);
  });
});

// ============================================================================
// normalizeCharacters
// ============================================================================
describe('normalizeCharacters', () => {
  it('returns empty array for null', () => {
    expect(normalizeCharacters(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(normalizeCharacters(undefined)).toEqual([]);
  });

  it('parses JSON string', () => {
    const chars = [{ name: 'Test', description: 'Desc' }];
    const result = normalizeCharacters(JSON.stringify(chars));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test');
  });

  it('returns empty array for invalid JSON', () => {
    expect(normalizeCharacters('not json')).toEqual([]);
  });

  it('returns empty array for non-array object', () => {
    expect(normalizeCharacters({ name: 'test' })).toEqual([]);
  });

  it('fills defaults for missing fields', () => {
    const result = normalizeCharacters([{ name: 'Test' }]);
    expect(result[0].description).toBe('');
    expect(result[0].age).toBe('');
    expect(result[0].gender).toBe('');
    expect(result[0].actor).toBe('');
  });

  it('preserves existing ids', () => {
    const result = normalizeCharacters([{ id: 'existing', name: 'Test', description: 'Desc' }]);
    expect(result[0].id).toBe('existing');
  });

  it('generates id when missing', () => {
    const result = normalizeCharacters([{ name: 'Test', description: 'Desc' }]);
    expect(result[0].id).toContain('char_');
  });
});

// ============================================================================
// serializeCharacters
// ============================================================================
describe('serializeCharacters', () => {
  it('sets displayOrder from array index', () => {
    const chars: Character[] = [
      { ...validCharacter, displayOrder: 5 },
      { ...validCharacter, id: 'char_2', displayOrder: 10 },
    ];
    const result = serializeCharacters(chars);
    expect(result[0].displayOrder).toBe(0);
    expect(result[1].displayOrder).toBe(1);
  });

  it('preserves essential character data', () => {
    const result = serializeCharacters([validCharacter]);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].description).toBe(validCharacter.description);
  });
});

// ============================================================================
// sortCharactersByOrder
// ============================================================================
describe('sortCharactersByOrder', () => {
  it('sorts by displayOrder ascending', () => {
    const chars: Character[] = [
      { ...validCharacter, displayOrder: 2 },
      { ...validCharacter, id: 'char_2', displayOrder: 0 },
      { ...validCharacter, id: 'char_3', displayOrder: 1 },
    ];
    const sorted = sortCharactersByOrder(chars);
    expect(sorted[0].displayOrder).toBe(0);
    expect(sorted[1].displayOrder).toBe(1);
    expect(sorted[2].displayOrder).toBe(2);
  });

  it('treats missing displayOrder as 0', () => {
    const chars: Character[] = [
      { ...validCharacter, displayOrder: 1 },
      { ...validCharacter, id: 'char_2', displayOrder: undefined },
    ];
    const sorted = sortCharactersByOrder(chars);
    expect(sorted[0].displayOrder).toBeUndefined();
  });

  it('does not mutate original array', () => {
    const chars: Character[] = [
      { ...validCharacter, displayOrder: 2 },
      { ...validCharacter, id: 'char_2', displayOrder: 0 },
    ];
    sortCharactersByOrder(chars);
    expect(chars[0].displayOrder).toBe(2);
  });
});

// ============================================================================
// reorderCharacters
// ============================================================================
describe('reorderCharacters', () => {
  const chars: Character[] = [
    { ...validCharacter, name: 'A', displayOrder: 0 },
    { ...validCharacter, id: 'char_2', name: 'B', displayOrder: 1 },
    { ...validCharacter, id: 'char_3', name: 'C', displayOrder: 2 },
  ];

  it('moves character from one position to another', () => {
    const result = reorderCharacters(chars, 0, 2);
    expect(result[0].name).toBe('B');
    expect(result[1].name).toBe('C');
    expect(result[2].name).toBe('A');
  });

  it('updates displayOrder after reorder', () => {
    const result = reorderCharacters(chars, 2, 0);
    expect(result[0].displayOrder).toBe(0);
    expect(result[1].displayOrder).toBe(1);
    expect(result[2].displayOrder).toBe(2);
  });

  it('returns original for same index', () => {
    const result = reorderCharacters(chars, 1, 1);
    expect(result).toBe(chars);
  });

  it('returns original for negative fromIndex', () => {
    expect(reorderCharacters(chars, -1, 1)).toBe(chars);
  });

  it('returns original for out-of-bounds toIndex', () => {
    expect(reorderCharacters(chars, 0, 10)).toBe(chars);
  });
});

// ============================================================================
// getCharacterStats
// ============================================================================
describe('getCharacterStats', () => {
  it('returns zero stats for empty array', () => {
    const stats = getCharacterStats([]);
    expect(stats.total).toBe(0);
    expect(stats.withActors).toBe(0);
    expect(stats.avgDescriptionLength).toBe(0);
  });

  it('counts total characters', () => {
    const stats = getCharacterStats([validCharacter, { ...validCharacter, id: 'c2' }]);
    expect(stats.total).toBe(2);
  });

  it('counts characters with actors', () => {
    const noActor = { ...validCharacter, actor: '' };
    const stats = getCharacterStats([validCharacter, noActor]);
    expect(stats.withActors).toBe(1);
  });

  it('counts characters with age', () => {
    const noAge = { ...validCharacter, age: '' };
    const stats = getCharacterStats([validCharacter, noAge]);
    expect(stats.withAge).toBe(1);
  });

  it('calculates average description length', () => {
    const c1 = { ...validCharacter, description: 'abcde' }; // 5 chars
    const c2 = { ...validCharacter, id: 'c2', description: 'abcdefghij' }; // 10 chars
    const stats = getCharacterStats([c1, c2]);
    expect(stats.avgDescriptionLength).toBe(8); // Math.round(15/2) = 8
  });
});
