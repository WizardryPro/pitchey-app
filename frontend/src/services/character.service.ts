// Character Service - Frontend integration with character management API
// Provides comprehensive character CRUD and ordering operations

import { apiClient } from '../lib/api-client';
import type { Character } from '@shared/types/character';

export interface CharacterOrderItem {
  id: number;
  displayOrder: number;
}

// API response types
interface CharacterResponseData {
  character?: Character;
  characters?: Character[];
}

interface CharactersResponseData {
  characters: Character[];
}

interface ApiCharacter {
  id?: number;
  name?: string;
  description?: string;
  age?: number | string;
  gender?: string;
  actor?: string;
  role?: string;
  relationship?: string;
  displayOrder?: number;
}

class CharacterService {
  /**
   * Get all characters for a pitch
   */
  async getCharacters(pitchId: number): Promise<Character[]> {
    try {
      const response = await apiClient.get<CharactersResponseData>(`/api/pitches/${pitchId}/characters`);

      if (response.success !== true) {
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to fetch characters');
      }

      return response.data?.characters ?? [];
    } catch (error: unknown) {
      console.error('Error fetching characters:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch characters';
      throw new Error(errorMessage);
    }
  }

  /**
   * Add a new character to a pitch
   */
  async addCharacter(pitchId: number, character: Omit<Character, 'id' | 'displayOrder'>): Promise<Character> {
    try {
      const response = await apiClient.post<CharacterResponseData>(`/api/pitches/${pitchId}/characters`, character);

      if (response.success !== true) {
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to add character');
      }

      if (response.data?.character === undefined) {
        throw new Error('No character returned from server');
      }

      return response.data.character;
    } catch (error: unknown) {
      console.error('Error adding character:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add character';
      throw new Error(errorMessage);
    }
  }

  /**
   * Update an existing character
   */
  async updateCharacter(pitchId: number, characterId: number, character: Omit<Character, 'id' | 'displayOrder'>): Promise<Character> {
    try {
      const response = await apiClient.put<CharacterResponseData>(`/api/pitches/${pitchId}/characters/${characterId}`, character);

      if (response.success !== true) {
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to update character');
      }

      if (response.data?.character === undefined) {
        throw new Error('No character returned from server');
      }

      return response.data.character;
    } catch (error: unknown) {
      console.error('Error updating character:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update character';
      throw new Error(errorMessage);
    }
  }

  /**
   * Delete a character
   */
  async deleteCharacter(pitchId: number, characterId: number): Promise<void> {
    try {
      const response = await apiClient.delete<Record<string, unknown>>(`/api/pitches/${pitchId}/characters/${characterId}`);

      if (response.success !== true) {
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to delete character');
      }
    } catch (error: unknown) {
      console.error('Error deleting character:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete character';
      throw new Error(errorMessage);
    }
  }

  /**
   * Reorder characters with full order specification
   */
  async reorderCharacters(pitchId: number, characterOrders: CharacterOrderItem[]): Promise<Character[]> {
    try {
      const response = await apiClient.post<CharactersResponseData>(`/api/pitches/${pitchId}/characters/reorder`, {
        characterOrders
      });

      if (response.success !== true) {
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to reorder characters');
      }

      return response.data?.characters ?? [];
    } catch (error: unknown) {
      console.error('Error reordering characters:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder characters';
      throw new Error(errorMessage);
    }
  }

  /**
   * Move a character up or down by one position
   */
  async moveCharacter(pitchId: number, characterId: number, direction: 'up' | 'down'): Promise<Character[]> {
    try {
      const response = await apiClient.patch<CharactersResponseData>(`/api/pitches/${pitchId}/characters/${characterId}/position`, {
        direction
      });

      if (response.success !== true) {
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to move character');
      }

      return response.data?.characters ?? [];
    } catch (error: unknown) {
      console.error('Error moving character:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to move character';
      throw new Error(errorMessage);
    }
  }

  /**
   * Convert frontend Character to API format
   */
  private toApiFormat(character: Partial<Character>): ApiCharacter {
    return {
      name: character.name,
      description: character.description,
      age: character.age,
      gender: character.gender,
      actor: character.actor,
      role: character.role,
      relationship: character.relationship,
    };
  }

  /**
   * Convert API response to frontend Character format
   */
  private fromApiFormat(apiCharacter: ApiCharacter): Character {
    return {
      id: apiCharacter.id !== undefined ? apiCharacter.id.toString() : '',
      name: apiCharacter.name ?? '',
      description: apiCharacter.description ?? '',
      age: typeof apiCharacter.age === 'number' ? apiCharacter.age.toString() : apiCharacter.age,
      gender: apiCharacter.gender,
      actor: apiCharacter.actor,
      role: apiCharacter.role,
      relationship: apiCharacter.relationship,
      displayOrder: apiCharacter.displayOrder ?? 0,
    };
  }

  /**
   * Batch character operations for optimistic updates
   */
  async batchUpdateCharacters(pitchId: number, operations: {
    add?: Omit<Character, 'id' | 'displayOrder'>[];
    update?: { id: number; character: Partial<Character> }[];
    delete?: number[];
    reorder?: CharacterOrderItem[];
  }): Promise<Character[]> {
    try {
      // Execute operations in sequence to maintain data consistency
      let characters = await this.getCharacters(pitchId);

      // Handle deletions first
      if (operations.delete !== undefined && operations.delete.length > 0) {
        for (const characterId of operations.delete) {
          await this.deleteCharacter(pitchId, characterId);
        }
      }

      // Handle updates
      if (operations.update !== undefined && operations.update.length > 0) {
        for (const { id, character } of operations.update) {
          await this.updateCharacter(pitchId, id, character as Omit<Character, 'id' | 'displayOrder'>);
        }
      }

      // Handle additions
      if (operations.add !== undefined && operations.add.length > 0) {
        for (const character of operations.add) {
          await this.addCharacter(pitchId, character);
        }
      }

      // Handle reordering last
      if (operations.reorder !== undefined && operations.reorder.length > 0) {
        characters = await this.reorderCharacters(pitchId, operations.reorder);
      } else {
        // Refetch to get updated list
        characters = await this.getCharacters(pitchId);
      }

      return characters;
    } catch (error: unknown) {
      console.error('Error in batch character update:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const characterService = new CharacterService();
export default characterService;
