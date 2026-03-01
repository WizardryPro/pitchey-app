import React from 'react';
import { ChevronUp, ChevronDown, Edit, Trash2, GripVertical } from 'lucide-react';
import type { Character } from '@shared/types/character';

interface CharacterCardProps {
  character: Character;
  index: number;
  totalCharacters: number;
  onEdit: (character: Character) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isReordering?: boolean;
  isLoading?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  index,
  totalCharacters,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isReordering = false,
  isLoading = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop
}) => {
  const canMoveUp = index > 0;
  const canMoveDown = index < totalCharacters - 1;

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${character.name || 'this character'}"?`)) {
      onDelete(character.id!);
    }
  };

  return (
    <div 
      className={`bg-gray-50 border rounded-lg p-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-purple-500 focus-within:ring-offset-2 ${
        isDragging 
          ? 'opacity-50 scale-105 shadow-lg border-purple-300' 
          : isDragOver 
            ? 'border-purple-400 bg-purple-50 shadow-md transform scale-102' 
            : 'border-gray-200 hover:shadow-sm hover:border-gray-300'
      } ${
        isReordering && !isDragging ? 'cursor-move' : ''
      }`}
      draggable={isReordering}
      onDragStart={onDragStart ? (e) => onDragStart(e, index) : undefined}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter ? (e) => onDragEnter(e, index) : undefined}
      onDragLeave={onDragLeave}
      onDrop={onDrop ? (e) => onDrop(e, index) : undefined}
      role="article"
      aria-label={`Character ${index + 1}: ${character.name || 'Unnamed Character'}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Character Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {isReordering && (
              <GripVertical className={`w-4 h-4 transition-colors ${
                isDragging ? 'text-purple-600' : 'text-gray-400'
              } cursor-grab active:cursor-grabbing`} />
            )}
            <h4 className={`font-medium truncate transition-colors ${
              isDragging ? 'text-purple-600' : 'text-gray-900'
            }`}>
              {character.name || 'Unnamed Character'}
            </h4>
            {character.age && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                {character.age}
              </span>
            )}
            {character.gender && (
              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                {character.gender}
              </span>
            )}
            {character.role && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                {character.role}
              </span>
            )}
          </div>
          
          {character.description && (
            <p className="text-sm text-gray-600 mb-2" 
               style={{
                 overflow: 'hidden',
                 display: '-webkit-box',
                 WebkitLineClamp: 2,
                 WebkitBoxOrient: 'vertical'
               }}>
              {character.description}
            </p>
          )}
          
          {character.relationship && (
            <p className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Relationships:</span> {character.relationship}
            </p>
          )}
          
          {character.actor && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Suggested Actor:</span> {character.actor}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Reorder Buttons - Always show for fine-tuning */}
          {isReordering && (
            <div className="flex flex-col" role="group" aria-label="Reorder controls">
              <button
                type="button"
                onClick={() => onMoveUp(index)}
                disabled={!canMoveUp || isDragging || isLoading}
                className={`p-1 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                  canMoveUp && !isDragging && !isLoading
                    ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200' 
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Move up"
                aria-label={`Move ${character.name || 'character'} up`}
              >
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(index)}
                disabled={!canMoveDown || isDragging || isLoading}
                className={`p-1 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                  canMoveDown && !isDragging && !isLoading
                    ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200' 
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Move down"
                aria-label={`Move ${character.name || 'character'} down`}
              >
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )}

          {!isReordering && (
            <div className="flex items-center gap-1" role="group" aria-label="Character actions">
              {/* Edit Button */}
              <button
                type="button"
                onClick={() => onEdit(character)}
                disabled={isDragging || isLoading}
                className={`p-2 rounded transition-colors ${
                  isDragging || isLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
                }`}
                title="Edit character"
                aria-label={`Edit ${character.name || 'character'}`}
              >
                <Edit className="w-4 h-4" aria-hidden="true" />
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDragging || isLoading}
                className={`p-2 rounded transition-colors ${
                  isDragging || isLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1'
                }`}
                title="Delete character"
                aria-label={`Delete ${character.name || 'character'}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};