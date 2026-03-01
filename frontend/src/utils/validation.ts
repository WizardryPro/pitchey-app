/**
 * Centralized validation system for Pitchey application
 * Provides reusable validation rules, error handling, and type-safe validation utilities
 */

import { VALIDATION_MESSAGES } from '@config/messages';

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string[]>;
}

// Field validation result type  
export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
}

// Validation rule function type
export type ValidationRule<T = any> = (value: T, context?: any) => FieldValidationResult;

// Common validation rules
export const validationRules = {
  // Required field validation
  required: (fieldName: string): ValidationRule<string> => (value: string) => ({
    isValid: value?.trim().length > 0,
    error: value?.trim().length > 0 ? undefined : VALIDATION_MESSAGES.REQUIRED_FIELD(fieldName)
  }),

  // Email validation
  email: (): ValidationRule<string> => (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(value);
    return {
      isValid,
      error: isValid ? undefined : VALIDATION_MESSAGES.INVALID_EMAIL
    };
  },

  // Password validation
  password: (): ValidationRule<string> => (value: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    
    if (value.length < minLength) {
      return { isValid: false, error: VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH(minLength) };
    }
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return { isValid: false, error: VALIDATION_MESSAGES.PASSWORD_COMPLEXITY };
    }
    
    return { isValid: true };
  },

  // Password confirmation validation
  passwordConfirm: (originalPassword: string): ValidationRule<string> => (value: string) => ({
    isValid: value === originalPassword,
    error: value === originalPassword ? undefined : VALIDATION_MESSAGES.PASSWORD_MISMATCH
  }),

  // URL validation
  url: (): ValidationRule<string> => (value: string) => {
    try {
      new URL(value);
      return { isValid: true };
    } catch {
      return { isValid: false, error: VALIDATION_MESSAGES.INVALID_URL };
    }
  },

  // Phone number validation (flexible format)
  phone: (): ValidationRule<string> => (value: string) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanedValue = value.replace(/[\s\-\(\)]/g, '');
    const isValid = phoneRegex.test(cleanedValue) && cleanedValue.length >= 10;
    return {
      isValid,
      error: isValid ? undefined : VALIDATION_MESSAGES.INVALID_PHONE
    };
  },

  // Min length validation
  minLength: (min: number): ValidationRule<string> => (value: string) => ({
    isValid: value.length >= min,
    error: value.length >= min ? undefined : VALIDATION_MESSAGES.MIN_LENGTH(min)
  }),

  // Max length validation
  maxLength: (max: number): ValidationRule<string> => (value: string) => ({
    isValid: value.length <= max,
    error: value.length <= max ? undefined : VALIDATION_MESSAGES.MAX_LENGTH(max)
  }),

  // File validation
  file: (options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    required?: boolean;
  } = {}): ValidationRule<File | null> => (value: File | null) => {
    const { maxSize = 10 * 1024 * 1024, allowedTypes, required = false } = options;
    
    if (!value) {
      return {
        isValid: !required,
        error: required ? VALIDATION_MESSAGES.FILE_REQUIRED : undefined
      };
    }
    
    if (value.size > maxSize) {
      return {
        isValid: false,
        error: VALIDATION_MESSAGES.FILE_TOO_LARGE((maxSize / 1024 / 1024).toFixed(1))
      };
    }
    
    if (allowedTypes && !allowedTypes.includes(value.type)) {
      return {
        isValid: false,
        error: VALIDATION_MESSAGES.FILE_INVALID_TYPE(allowedTypes.join(', '))
      };
    }
    
    return { isValid: true };
  },

  // Select/dropdown validation
  select: (fieldName: string): ValidationRule<string> => (value: string) => ({
    isValid: value !== '' && value !== null && value !== undefined,
    error: value !== '' && value !== null && value !== undefined ? undefined : VALIDATION_MESSAGES.REQUIRED_SELECTION(fieldName)
  }),

  // Checkbox validation (for terms, agreements, etc.)
  checkbox: (fieldName: string): ValidationRule<boolean> => (value: boolean) => ({
    isValid: value === true,
    error: value === true ? undefined : VALIDATION_MESSAGES.REQUIRED_AGREEMENT(fieldName)
  }),

  // Custom validation
  custom: (validator: (value: any) => boolean, errorMessage: string): ValidationRule => (value: any) => ({
    isValid: validator(value),
    error: validator(value) ? undefined : errorMessage
  })
};

// Form validation schemas
export const validationSchemas = {
  // Login form validation
  login: {
    email: [validationRules.required('Email'), validationRules.email()],
    password: [validationRules.required('Password')]
  },

  // Pitch creation validation
  pitch: {
    title: [validationRules.required('Title'), validationRules.maxLength(100)],
    genre: [validationRules.select('Genre')],
    formatCategory: [validationRules.select('Format Category')],
    formatSubtype: [validationRules.select('Format Subtype')],
    customFormat: [validationRules.required('Custom Format')], // Applied conditionally
    logline: [validationRules.required('Logline'), validationRules.maxLength(300)],
    shortSynopsis: [validationRules.required('Short Synopsis'), validationRules.maxLength(1000)],
    themes: [validationRules.maxLength(1000)],
    worldDescription: [validationRules.maxLength(2000)],
    image: [validationRules.file({ 
      maxSize: 10 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      required: false
    })],
    pdf: [validationRules.file({
      maxSize: 10 * 1024 * 1024,
      allowedTypes: ['application/pdf'],
      required: false
    })],
    video: [validationRules.file({
      maxSize: 50 * 1024 * 1024,
      allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
      required: false
    })]
  },

  // Production registration validation
  productionRegistration: {
    // Company info
    companyName: [validationRules.required('Company Name'), validationRules.maxLength(100)],
    registrationNumber: [validationRules.required('Registration Number'), validationRules.maxLength(50)],
    website: [validationRules.required('Website'), validationRules.url()],
    
    // Contact details
    companyEmail: [validationRules.required('Company Email'), validationRules.email()],
    companyPhone: [validationRules.required('Company Phone'), validationRules.phone()],
    address: [validationRules.required('Address'), validationRules.maxLength(200)],
    city: [validationRules.required('City'), validationRules.maxLength(100)],
    state: [validationRules.required('State/Province'), validationRules.maxLength(100)],
    zipCode: [validationRules.required('ZIP Code'), validationRules.maxLength(20)],
    country: [validationRules.required('Country'), validationRules.maxLength(100)],
    
    // Optional social media
    linkedin: [validationRules.url()], // Optional URL validation
    twitter: [validationRules.url()],
    instagram: [validationRules.url()],
    facebook: [validationRules.url()],
    
    // Representative info
    firstName: [validationRules.required('First Name'), validationRules.maxLength(50)],
    lastName: [validationRules.required('Last Name'), validationRules.maxLength(50)],
    position: [validationRules.required('Position'), validationRules.maxLength(100)],
    
    // Account credentials
    email: [validationRules.required('Account Email'), validationRules.email()],
    username: [validationRules.required('Username'), validationRules.minLength(3), validationRules.maxLength(30)],
    password: [validationRules.required('Password'), validationRules.password()],
    confirmPassword: [validationRules.required('Confirm Password')], // Password confirmation added dynamically
    
    // Terms and agreements
    agreeToTerms: [validationRules.checkbox('Terms of Service')],
    agreeToVetting: [validationRules.checkbox('Verification Process')]
  }
};

// Validation utility class
export class FormValidator {
  private schema: Record<string, ValidationRule[]>;
  private errors: Record<string, string[]> = {};
  private isValid = true;

  constructor(schema: Record<string, ValidationRule[]>) {
    this.schema = schema;
  }

  // Validate a single field
  validateField(fieldName: string, value: any, context?: any): FieldValidationResult {
    const rules = this.schema[fieldName];
    if (!rules) {
      return { isValid: true };
    }

    for (const rule of rules) {
      const result = rule(value, context);
      if (!result.isValid) {
        return result;
      }
    }

    return { isValid: true };
  }

  // Validate entire form
  validateForm(data: Record<string, any>, context?: any): ValidationResult {
    this.errors = {};
    this.isValid = true;
    const allErrors: string[] = [];

    Object.keys(this.schema).forEach(fieldName => {
      const value = data[fieldName];
      const result = this.validateField(fieldName, value, context);
      
      if (!result.isValid && result.error) {
        this.errors[fieldName] = [result.error];
        allErrors.push(result.error);
        this.isValid = false;
      }
    });

    return {
      isValid: this.isValid,
      errors: allErrors,
      fieldErrors: this.errors
    };
  }

  // Get errors for a specific field
  getFieldErrors(fieldName: string): string[] {
    return this.errors[fieldName] || [];
  }

  // Check if field has errors
  hasFieldErrors(fieldName: string): boolean {
    return this.errors[fieldName] && this.errors[fieldName].length > 0;
  }

  // Clear errors for a field
  clearFieldErrors(fieldName: string): void {
    delete this.errors[fieldName];
  }

  // Clear all errors
  clearAllErrors(): void {
    this.errors = {};
    this.isValid = true;
  }
}

// Real-time validation hook utilities
export const createValidator = (schema: Record<string, ValidationRule[]>) => {
  return new FormValidator(schema);
};

// Utility function to validate pitch with conditional custom format
export const validatePitchForm = (data: any): ValidationResult => {
  const schema: Record<string, ValidationRule[]> = { ...validationSchemas.pitch };

  // Add conditional validation for custom format
  if (data.formatSubtype === 'Custom Format (please specify)') {
    schema.customFormat = [validationRules.required('Custom Format'), validationRules.maxLength(100)];
  } else {
    // Use omit pattern instead of delete
    const { customFormat, ...rest } = schema;
    return new FormValidator(rest).validateForm(data);
  }

  const validator = new FormValidator(schema);
  return validator.validateForm(data);
};

// Utility function to validate production registration with password confirmation
export const validateProductionRegistration = (data: any): ValidationResult => {
  const schema: Record<string, ValidationRule[]> = { ...validationSchemas.productionRegistration };

  // Add password confirmation validation
  schema.confirmPassword = [
    validationRules.required('Confirm Password'),
    validationRules.passwordConfirm(data.password)
  ];

  // Make social media fields optional but validate format if provided
  const optionalUrlFields = ['linkedin', 'twitter', 'instagram', 'facebook'];
  optionalUrlFields.forEach(field => {
    if (data[field] && data[field].trim() !== '') {
      schema[field] = [validationRules.url()];
    } else {
      delete schema[field];
    }
  });

  const validator = new FormValidator(schema);
  return validator.validateForm(data);
};

// Export utility functions for common validations
export const validateEmail = (email: string): boolean => {
  return validationRules.email()(email).isValid;
};

export const validatePassword = (password: string): FieldValidationResult => {
  return validationRules.password()(password);
};

export const validateRequired = (value: string, fieldName: string): FieldValidationResult => {
  return validationRules.required(fieldName)(value);
};