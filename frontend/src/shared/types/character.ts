export interface Character {
  id?: string; // Database ID (converted to string for frontend compatibility)
  name: string;
  description: string;
  age?: string;
  gender?: string;
  actor?: string;
  role?: string; // Character's role/position in the story
  relationship?: string; // Key relationships to other characters
  displayOrder?: number; // For ordering characters (managed by backend)
}

export interface CharacterFormData extends Character {
  isEditing?: boolean;
}