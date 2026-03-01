import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import type { Character } from '@shared/types/character';

interface CharacterFormProps {
  character?: Character;
  isOpen: boolean;
  onSave: (character: Character) => void;
  onCancel: () => void;
}

export const CharacterForm: React.FC<CharacterFormProps> = ({
  character,
  isOpen,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Character>({
    id: '',
    name: '',
    description: '',
    age: '',
    gender: '',
    actor: '',
    role: '',
    relationship: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (character) {
      setFormData({
        ...character,
        role: character.role || '',
        relationship: character.relationship || ''
      });
    } else {
      setFormData({
        id: '',
        name: '',
        description: '',
        age: '',
        gender: '',
        actor: '',
        role: '',
        relationship: ''
      });
    }
    setErrors({});
    setIsDirty(false);
  }, [character, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    setIsDirty(true);
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Character name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Character name must be less than 100 characters';
    }
    
    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Character description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description should be at least 10 characters';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Age validation (if provided)
    if (formData.age && formData.age.length > 20) {
      newErrors.age = 'Age must be less than 20 characters';
    }

    // Actor validation (if provided)
    if (formData.actor && formData.actor.length > 100) {
      newErrors.actor = 'Actor name must be less than 100 characters';
    }

    // Role validation (if provided)
    if (formData.role && formData.role.length > 100) {
      newErrors.role = 'Role must be less than 100 characters';
    }

    // Relationship validation (if provided)
    if (formData.relationship && formData.relationship.length > 200) {
      newErrors.relationship = 'Relationship must be less than 200 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Generate ID if this is a new character
    const characterToSave = {
      ...formData,
      id: formData.id || `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    onSave(characterToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onCancel}
        />

        {/* Modal panel */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {character ? 'Edit Character' : 'Add New Character'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Character Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Character Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                maxLength={100}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
                placeholder="Enter character name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
              <p className={`mt-1 text-xs ${
                formData.name.length > 80 ? 'text-orange-500' : 'text-gray-500'
              }`}>
                {formData.name.length}/100 characters
              </p>
            </div>

            {/* Character Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                maxLength={500}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors resize-none ${
                  errors.description 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
                placeholder="Describe the character's role, personality, and significance to the story"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
              <p className={`mt-1 text-xs ${
                formData.description.length > 450 
                  ? 'text-red-500' 
                  : formData.description.length > 400 
                    ? 'text-orange-500' 
                    : 'text-gray-500'
              }`}>
                {formData.description.length}/500 characters
                {formData.description.length < 10 && ' (minimum 10 characters)'}
              </p>
            </div>

            {/* Age and Gender Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="text"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  maxLength={20}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.age 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  }`}
                  placeholder="e.g., 25, 30s, Teen"
                />
                {errors.age && (
                  <p className="mt-1 text-sm text-red-600">{errors.age}</p>
                )}
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Not specified">Not specified</option>
                </select>
              </div>
            </div>

            {/* Character Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role/Position (Optional)
              </label>
              <input
                type="text"
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                maxLength={100}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.role 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
                placeholder="e.g., Protagonist, Antagonist, Supporting, Mentor"
              />
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role}</p>
              )}
            </div>

            {/* Character Relationships */}
            <div>
              <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
                Key Relationships (Optional)
              </label>
              <input
                type="text"
                id="relationship"
                name="relationship"
                value={formData.relationship}
                onChange={handleInputChange}
                maxLength={200}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.relationship 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
                placeholder="e.g., Father to Jane, Rival of John, Love interest"
              />
              {errors.relationship && (
                <p className="mt-1 text-sm text-red-600">{errors.relationship}</p>
              )}
            </div>

            {/* Suggested Actor */}
            <div>
              <label htmlFor="actor" className="block text-sm font-medium text-gray-700 mb-1">
                Suggested Actor (Optional)
              </label>
              <input
                type="text"
                id="actor"
                name="actor"
                value={formData.actor}
                onChange={handleInputChange}
                maxLength={100}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.actor 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
                placeholder="Actor you envision for this role"
              />
              {errors.actor && (
                <p className="mt-1 text-sm text-red-600">{errors.actor}</p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (isDirty && (formData.name.trim() || formData.description.trim())) {
                    if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                      onCancel();
                    }
                  } else {
                    onCancel();
                  }
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.name.trim() || !formData.description.trim() || formData.description.length < 10}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                {character ? 'Update Character' : 'Add Character'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};