import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Users, AlertCircle, ArrowUpDown, Info } from 'lucide-react';
import type { Character } from '@shared/types/character';
import { CharacterCard } from './CharacterCard';
import { CharacterForm } from './CharacterForm';
import { getCharacterStats } from '../../utils/characterUtils';
import { characterService } from '../../services/character.service';

interface CharacterManagementProps {
  pitchId?: number; // Optional - if not provided, operates in local mode for pitch creation
  characters: Character[];
  onChange: (characters: Character[]) => void;
  maxCharacters?: number;
}

export const CharacterManagement: React.FC<CharacterManagementProps> = ({
  pitchId,
  characters,
  onChange,
  maxCharacters = 10
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>();
  const [isReordering, setIsReordering] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const lastCharacterRef = useRef<HTMLDivElement>(null);

  // Ensure characters have unique IDs
  const normalizedCharacters = characters.map((char, index) => ({
    ...char,
    id: char.id || `char_${index}_${Date.now()}`,
    displayOrder: char.displayOrder ?? index
  }));

  const handleAddCharacter = () => {
    if (normalizedCharacters.length >= maxCharacters) {
      alert(`You can only add up to ${maxCharacters} characters.`);
      return;
    }
    setEditingCharacter(undefined);
    setIsFormOpen(true);
  };

  // Auto-scroll to newly added character
  useEffect(() => {
    if (lastCharacterRef.current && !isFormOpen && normalizedCharacters.length > 0) {
      const timeoutId = setTimeout(() => {
        lastCharacterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [normalizedCharacters.length, isFormOpen]);

  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setIsFormOpen(true);
  };

  const handleSaveCharacter = async (character: Character) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (pitchId) {
        // API mode - pitch already exists
        let updatedCharacter: Character;
        
        if (editingCharacter && editingCharacter.id) {
          // Update existing character via API
          const characterData = {
            name: character.name,
            description: character.description,
            age: character.age,
            gender: character.gender,
            actor: character.actor,
            role: character.role,
            relationship: character.relationship,
          };
          
          updatedCharacter = await characterService.updateCharacter(
            pitchId, 
            parseInt(editingCharacter.id), 
            characterData
          );
          
          // Update local state
          const updatedCharacters = normalizedCharacters.map(char => 
            char.id === editingCharacter.id ? { ...updatedCharacter, id: updatedCharacter.id?.toString() } : char
          );
          onChange(updatedCharacters);
        } else {
          // Add new character via API
          const characterData = {
            name: character.name,
            description: character.description,
            age: character.age,
            gender: character.gender,
            actor: character.actor,
            role: character.role,
            relationship: character.relationship,
          };
          
          updatedCharacter = await characterService.addCharacter(pitchId, characterData);
          
          // Add to local state
          const newCharacter = { ...updatedCharacter, id: updatedCharacter.id?.toString() };
          onChange([...normalizedCharacters, newCharacter]);
        }
      } else {
        // Local mode - for pitch creation
        if (editingCharacter && editingCharacter.id) {
          // Update existing character locally
          const updatedCharacters = normalizedCharacters.map(char => 
            char.id === editingCharacter.id ? { ...char, ...character, id: char.id } : char
          );
          onChange(updatedCharacters);
        } else {
          // Add new character locally
          const newCharacter: Character = {
            ...character,
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            displayOrder: normalizedCharacters.length
          };
          onChange([...normalizedCharacters, newCharacter]);
        }
      }
      
      setIsFormOpen(false);
      setEditingCharacter(undefined);
    } catch (error) {
      console.error('Error saving character:', error);
      setError(error instanceof Error ? error.message : 'Failed to save character');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm('Are you sure you want to delete this character?')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (pitchId) {
        // API mode - delete from server
        await characterService.deleteCharacter(pitchId, parseInt(id));
      }
      // In both API and local mode, remove from local state
      const updatedCharacters = normalizedCharacters.filter(char => char.id !== id);
      onChange(updatedCharacters);
    } catch (error) {
      console.error('Error deleting character:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete character');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveCharacter = useCallback(async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= normalizedCharacters.length || fromIndex === toIndex) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create optimistic update
      const updatedCharacters = [...normalizedCharacters];
      const [movedCharacter] = updatedCharacters.splice(fromIndex, 1);
      updatedCharacters.splice(toIndex, 0, movedCharacter);
      
      // Update display orders
      const charactersWithOrder = updatedCharacters.map((char, index) => ({
        ...char,
        displayOrder: index
      }));
      
      if (pitchId) {
        // API mode - sync with server
        const characterOrders = charactersWithOrder.map((char, index) => ({
          id: parseInt(char.id || '0'),
          displayOrder: index
        }));
        
        const reorderedCharacters = await characterService.reorderCharacters(pitchId, characterOrders);
        
        // Update with API response (convert IDs to strings for frontend compatibility)
        const formattedCharacters = reorderedCharacters.map(char => ({
          ...char,
          id: char.id?.toString()
        }));
        
        onChange(formattedCharacters);
      } else {
        // Local mode - just update local state
        onChange(charactersWithOrder);
      }
    } catch (error) {
      console.error('Error reordering characters:', error);
      setError(error instanceof Error ? error.message : 'Failed to reorder characters');
    } finally {
      setIsLoading(false);
    }
  }, [pitchId, normalizedCharacters, onChange]);

  const handleMoveUp = useCallback(async (index: number) => {
    if (index <= 0) return;
    
    const character = normalizedCharacters[index];
    if (!character.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (pitchId) {
        // API mode - call server
        const updatedCharacters = await characterService.moveCharacter(pitchId, parseInt(character.id), 'up');
        
        // Update with API response
        const formattedCharacters = updatedCharacters.map(char => ({
          ...char,
          id: char.id?.toString()
        }));
        
        onChange(formattedCharacters);
      } else {
        // Local mode - just reorder locally
        const updatedCharacters = [...normalizedCharacters];
        const [movedCharacter] = updatedCharacters.splice(index, 1);
        updatedCharacters.splice(index - 1, 0, movedCharacter);
        
        // Update display orders
        const charactersWithOrder = updatedCharacters.map((char, idx) => ({
          ...char,
          displayOrder: idx
        }));
        
        onChange(charactersWithOrder);
      }
    } catch (error) {
      console.error('Error moving character up:', error);
      setError(error instanceof Error ? error.message : 'Failed to move character');
    } finally {
      setIsLoading(false);
    }
  }, [pitchId, normalizedCharacters, onChange]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (index >= normalizedCharacters.length - 1) return;
    
    const character = normalizedCharacters[index];
    if (!character.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (pitchId) {
        // API mode - call server
        const updatedCharacters = await characterService.moveCharacter(pitchId, parseInt(character.id), 'down');
        
        // Update with API response
        const formattedCharacters = updatedCharacters.map(char => ({
          ...char,
          id: char.id?.toString()
        }));
        
        onChange(formattedCharacters);
      } else {
        // Local mode - just reorder locally
        const updatedCharacters = [...normalizedCharacters];
        const [movedCharacter] = updatedCharacters.splice(index, 1);
        updatedCharacters.splice(index + 1, 0, movedCharacter);
        
        // Update display orders
        const charactersWithOrder = updatedCharacters.map((char, idx) => ({
          ...char,
          displayOrder: idx
        }));
        
        onChange(charactersWithOrder);
      }
    } catch (error) {
      console.error('Error moving character down:', error);
      setError(error instanceof Error ? error.message : 'Failed to move character');
    } finally {
      setIsLoading(false);
    }
  }, [pitchId, normalizedCharacters, onChange]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', (e.currentTarget as HTMLElement).outerHTML);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItem(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem !== null && draggedItem !== dropIndex) {
      handleMoveCharacter(draggedItem, dropIndex);
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, handleMoveCharacter]);

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingCharacter(undefined);
    // Return focus to add button after form closes
    setTimeout(() => {
      addButtonRef.current?.focus();
    }, 100);
  };

  // Calculate character statistics
  const stats = getCharacterStats(normalizedCharacters);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isReordering) {
        event.preventDefault();
        setIsReordering(false);
      }
    };

    if (isReordering) {
      document.addEventListener('keydown', handleGlobalKeyDown);
      return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [isReordering]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Characters</h3>
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            {normalizedCharacters.length}/{maxCharacters}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {normalizedCharacters.length > 1 && (
            <button
              type="button"
              onClick={() => setIsReordering(!isReordering)}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isReordering
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={isReordering ? 'Finish reordering' : 'Reorder characters'}
            >
              <ArrowUpDown className="w-4 h-4" />
              {isReordering ? 'Done' : 'Reorder'}
            </button>
          )}
          
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAddCharacter}
            onKeyDown={(e) => handleKeyDown(e, handleAddCharacter)}
            disabled={normalizedCharacters.length >= maxCharacters || isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
              normalizedCharacters.length >= maxCharacters || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
            aria-describedby="add-character-help"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Character
          </button>
          
          <div id="add-character-help" className="sr-only">
            {normalizedCharacters.length >= maxCharacters 
              ? `Maximum of ${maxCharacters} characters reached` 
              : `Add a new character to your pitch. ${maxCharacters - normalizedCharacters.length} slots remaining.`
            }
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-800 mb-1">Error</p>
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="relative">
          <div className="absolute inset-0 bg-white/70 rounded-lg z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-purple-600">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Updating characters...</span>
            </div>
          </div>
        </div>
      )}

      {/* Instructions and Stats */}
      <div className={`p-4 border rounded-lg transition-colors ${
        isReordering 
          ? 'bg-orange-50 border-orange-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            isReordering ? 'text-orange-600' : 'text-blue-600'
          }`} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className={`font-medium text-sm ${
                isReordering ? 'text-orange-800' : 'text-blue-800'
              }`}>
                {isReordering ? 'Reordering Mode:' : 'Character Management Tips:'}
              </p>
              {normalizedCharacters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowStats(!showStats)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    isReordering 
                      ? 'text-orange-700 hover:bg-orange-100' 
                      : 'text-blue-700 hover:bg-blue-100'
                  }`}
                  title="Toggle character statistics"
                >
                  <Info className="w-3 h-3" />
                  {showStats ? 'Hide' : 'Show'} Stats
                </button>
              )}
            </div>
            <ul className={`text-sm space-y-1 ${
              isReordering ? 'text-orange-700' : 'text-blue-700'
            }`}>
              {isReordering ? (
                <>
                  <li>• Drag and drop characters to reorder them</li>
                  <li>• Use up/down arrows for precise positioning</li>
                  <li>• Press Escape or click "Done" when finished</li>
                </>
              ) : (
                <>
                  <li>• Add key characters that drive your story forward</li>
                  <li>• Include main characters, antagonists, and important supporting roles</li>
                  <li>• Use the reorder mode to arrange characters by importance</li>
                  <li>• Rich character details help investors understand your story's scope</li>
                </>
              )}
            </ul>
            
            {/* Character Statistics */}
            {showStats && normalizedCharacters.length > 0 && (
              <div className={`mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs ${
                isReordering ? 'border-orange-300' : 'border-blue-300'
              }`}>
                <div className={isReordering ? 'text-orange-700' : 'text-blue-700'}>
                  <span className="font-medium">Total:</span> {stats.total}
                </div>
                <div className={isReordering ? 'text-orange-700' : 'text-blue-700'}>
                  <span className="font-medium">With Roles:</span> {stats.withRole}
                </div>
                <div className={isReordering ? 'text-orange-700' : 'text-blue-700'}>
                  <span className="font-medium">With Ages:</span> {stats.withAge}
                </div>
                <div className={isReordering ? 'text-orange-700' : 'text-blue-700'}>
                  <span className="font-medium">With Actors:</span> {stats.withActors}
                </div>
                <div className={`col-span-2 ${isReordering ? 'text-orange-700' : 'text-blue-700'}`}>
                  <span className="font-medium">Avg. Description:</span> {stats.avgDescriptionLength} chars
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Character List */}
      {normalizedCharacters.length > 0 ? (
        <div className="space-y-3" role="list" aria-label="Character list">
          {normalizedCharacters.map((character, index) => (
            <div 
              key={character.id}
              ref={index === normalizedCharacters.length - 1 ? lastCharacterRef : undefined}
              role="listitem"
            >
              <CharacterCard
                character={character}
                index={index}
                totalCharacters={normalizedCharacters.length}
                onEdit={handleEditCharacter}
                onDelete={handleDeleteCharacter}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                isReordering={isReordering}
                isLoading={isLoading}
                isDragging={draggedItem === index}
                isDragOver={dragOverItem === index}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Characters Added</h4>
          <p className="text-gray-600 mb-4">
            Add characters to help investors understand your story's cast and scope.
          </p>
          <button
            type="button"
            onClick={handleAddCharacter}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Character
          </button>
        </div>
      )}

      {/* Character Form Modal */}
      <CharacterForm
        character={editingCharacter}
        isOpen={isFormOpen}
        onSave={handleSaveCharacter}
        onCancel={handleCancel}
      />
    </div>
  );
};