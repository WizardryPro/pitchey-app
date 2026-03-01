import type { Character } from '@shared/types/character';

/**
 * Character validation rules
 */
export const VALIDATION_RULES = {
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100
  },
  DESCRIPTION: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500
  },
  AGE: {
    MAX_LENGTH: 20
  },
  ACTOR: {
    MAX_LENGTH: 100
  }
} as const;

/**
 * Validates a single character
 */
export function validateCharacter(character: Character): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Name validation
  if (!character.name?.trim()) {
    errors.name = 'Character name is required';
  } else if (character.name.length > VALIDATION_RULES.NAME.MAX_LENGTH) {
    errors.name = `Character name must be less than ${VALIDATION_RULES.NAME.MAX_LENGTH} characters`;
  }

  // Description validation
  if (!character.description?.trim()) {
    errors.description = 'Character description is required';
  } else if (character.description.length < VALIDATION_RULES.DESCRIPTION.MIN_LENGTH) {
    errors.description = `Description should be at least ${VALIDATION_RULES.DESCRIPTION.MIN_LENGTH} characters`;
  } else if (character.description.length > VALIDATION_RULES.DESCRIPTION.MAX_LENGTH) {
    errors.description = `Description must be less than ${VALIDATION_RULES.DESCRIPTION.MAX_LENGTH} characters`;
  }

  // Age validation (optional)
  if (character.age && character.age.length > VALIDATION_RULES.AGE.MAX_LENGTH) {
    errors.age = `Age must be less than ${VALIDATION_RULES.AGE.MAX_LENGTH} characters`;
  }

  // Actor validation (optional)
  if (character.actor && character.actor.length > VALIDATION_RULES.ACTOR.MAX_LENGTH) {
    errors.actor = `Actor name must be less than ${VALIDATION_RULES.ACTOR.MAX_LENGTH} characters`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates an array of characters
 */
export function validateCharacters(characters: Character[]): { isValid: boolean; errors: Array<{ index: number; errors: Record<string, string> }> } {
  const characterErrors: Array<{ index: number; errors: Record<string, string> }> = [];

  characters.forEach((character, index) => {
    const validation = validateCharacter(character);
    if (!validation.isValid) {
      characterErrors.push({
        index,
        errors: validation.errors
      });
    }
  });

  return {
    isValid: characterErrors.length === 0,
    errors: characterErrors
  };
}

/**
 * Generates a unique character ID
 */
export function generateCharacterId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalizes character data from backend to ensure proper structure
 */
export function normalizeCharacters(characters: any): Character[] {
  if (!characters) return [];
  
  // If it's a string, try to parse it
  if (typeof characters === 'string') {
    try {
      characters = JSON.parse(characters);
    } catch (e) {
      return [];
    }
  }
  
  // If it's not an array, return empty array
  if (!Array.isArray(characters)) {
    return [];
  }
  
  // Normalize each character
  return characters.map((char, index) => ({
    id: char.id || `char_${index}_${Date.now()}`,
    name: char.name || '',
    description: char.description || '',
    age: char.age || '',
    gender: char.gender || '',
    actor: char.actor || '',
    displayOrder: char.displayOrder ?? index
  }));
}

/**
 * Converts characters to the format expected by the backend
 */
export function serializeCharacters(characters: Character[]): Character[] {
  return characters.map(({ id, displayOrder, ...char }, index) => ({
    ...char,
    // Remove client-side only fields, keep essential data
    displayOrder: index // Use array index as display order
  }));
}

/**
 * Sorts characters by display order
 */
export function sortCharactersByOrder(characters: Character[]): Character[] {
  return [...characters].sort((a, b) => {
    const orderA = a.displayOrder ?? 0;
    const orderB = b.displayOrder ?? 0;
    return orderA - orderB;
  });
}

/**
 * Reorders characters by moving one from fromIndex to toIndex
 */
export function reorderCharacters(characters: Character[], fromIndex: number, toIndex: number): Character[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || 
      fromIndex >= characters.length || toIndex >= characters.length) {
    return characters;
  }

  const reordered = [...characters];
  const [movedCharacter] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedCharacter);

  // Update display order
  return reordered.map((char, index) => ({
    ...char,
    displayOrder: index
  }));
}

/**
 * Gets character statistics
 */
export function getCharacterStats(characters: Character[]): {
  total: number;
  withActors: number;
  withAge: number;
  withRole: number;
  withRelationships: number;
  avgDescriptionLength: number;
} {
  const total = characters.length;
  const withActors = characters.filter(char => char.actor?.trim()).length;
  const withAge = characters.filter(char => char.age?.trim()).length;
  const withRole = characters.filter(char => char.role?.trim()).length;
  const withRelationships = characters.filter(char => char.relationship?.trim()).length;
  const avgDescriptionLength = total > 0 
    ? Math.round(characters.reduce((sum, char) => sum + (char.description?.length || 0), 0) / total)
    : 0;

  return {
    total,
    withActors,
    withAge,
    withRole,
    withRelationships,
    avgDescriptionLength
  };
}