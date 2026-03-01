/**
 * Externalized message constants for the Pitchey application
 * Centralizes all user-facing messages for consistency and internationalization
 */

// Validation error messages
export const VALIDATION_MESSAGES = {
  // Required field messages
  REQUIRED_FIELD: (fieldName: string) => `${fieldName} is required`,
  REQUIRED_SELECTION: (fieldName: string) => `Please select a ${fieldName.toLowerCase()}`,
  REQUIRED_AGREEMENT: (fieldName: string) => `You must agree to the ${fieldName.toLowerCase()}`,
  FILE_REQUIRED: 'Please upload a file',
  
  // Email validation
  INVALID_EMAIL: 'Please enter a valid email address',
  
  // Password validation
  PASSWORD_MIN_LENGTH: (min: number) => `Password must be at least ${min} characters long`,
  PASSWORD_COMPLEXITY: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  PASSWORD_MISMATCH: 'Passwords do not match',
  
  // URL validation
  INVALID_URL: 'Please enter a valid URL (e.g., https://example.com)',
  
  // Phone validation
  INVALID_PHONE: 'Please enter a valid phone number',
  
  // Length validation
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters long`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters long`,
  
  // File validation
  FILE_TOO_LARGE: (maxSizeMB: string) => `File size must be less than ${maxSizeMB}MB`,
  FILE_INVALID_TYPE: (allowedTypes: string) => `Invalid file type. Allowed types: ${allowedTypes}`,
  
  // Custom validation
  CUSTOM_FORMAT_REQUIRED: 'Please specify your custom format',
  
  // Form-specific messages
  FORM_HAS_ERRORS: 'Please fix the following errors before submitting:',
  FORM_SUBMITTED_SUCCESSFULLY: 'Form submitted successfully',
  
  // Network/API errors
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'Invalid credentials. Please check your email and password.',
  FORBIDDEN: 'You do not have permission to perform this action.',
};

// Success messages
export const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: 'Welcome back! You have been successfully logged in.',
  LOGOUT_SUCCESS: 'You have been logged out successfully.',
  REGISTRATION_SUCCESS: 'Registration successful! Please check your email for verification.',
  
  // Pitch management
  PITCH_CREATED: 'Pitch created successfully! Your pitch is now live.',
  PITCH_UPDATED: 'Pitch updated successfully.',
  PITCH_DELETED: 'Pitch deleted successfully.',
  PITCH_SUBMITTED: 'Your pitch has been submitted for review.',
  
  // File uploads
  FILE_UPLOADED: 'File uploaded successfully.',
  IMAGE_UPLOADED: 'Cover image uploaded successfully.',
  PDF_UPLOADED: 'PDF document uploaded successfully.',
  VIDEO_UPLOADED: 'Video uploaded successfully.',
  
  // Profile/Company
  PROFILE_UPDATED: 'Profile updated successfully.',
  COMPANY_VERIFIED: 'Company verification completed successfully.',
  
  // NDA
  NDA_SIGNED: 'NDA signed successfully. You now have access to full pitch content.',
  NDA_REQUESTED: 'NDA request sent successfully.',
};

// Informational messages
export const INFO_MESSAGES = {
  // Loading states
  LOADING_PITCHES: 'Loading pitches...',
  UPLOADING_FILE: 'Uploading file...',
  CREATING_PITCH: 'Creating pitch...',
  UPDATING_PROFILE: 'Updating profile...',
  SIGNING_IN: 'Signing in...',
  SUBMITTING_FORM: 'Submitting...',
  VERIFYING_COMPANY: 'Verifying company information...',
  
  // Form guidance
  PASSWORD_REQUIREMENTS: 'Password must be at least 8 characters with uppercase, lowercase, and number',
  FILE_SIZE_LIMIT: (sizeMB: number) => `Maximum file size: ${sizeMB}MB`,
  OPTIONAL_FIELD: 'This field is optional',
  REQUIRED_FIELD: 'This field is required',
  
  // Feature descriptions
  NDA_PROTECTION: 'Viewers must sign a Non-Disclosure Agreement before accessing your full pitch content. This helps protect your intellectual property.',
  PITCH_VISIBILITY: 'Your pitch will be visible to verified investors and production companies.',
  VERIFICATION_PROCESS: 'Your company information will be verified by our team within 24-48 hours.',
  
  // Demo accounts
  DEMO_ACCOUNT_INFO: 'Try our demo account to explore the platform',
  DEMO_DATA_WARNING: 'This is a demo account with sample data for testing purposes',
  
  // File upload instructions
  IMAGE_UPLOAD_INSTRUCTIONS: 'Upload a compelling cover image for your pitch. Supported formats: JPG, PNG, GIF, WebP',
  PDF_UPLOAD_INSTRUCTIONS: 'Upload your script, treatment, or pitch deck. Must be in PDF format.',
  VIDEO_UPLOAD_INSTRUCTIONS: 'Upload a pitch video to make your submission stand out. Supported formats: MP4, MOV, AVI',
  
  // Character limits
  CHARACTER_COUNT: (current: number, max: number) => `${current}/${max} characters`,
  CHARACTER_REMAINING: (remaining: number) => `${remaining} characters remaining`,
  RECOMMENDED_LENGTH: (current: number, recommended: number) => `${current}/${recommended} characters recommended`,
};

// Warning messages
export const WARNING_MESSAGES = {
  // Data loss warnings
  UNSAVED_CHANGES: 'You have unsaved changes. Are you sure you want to leave?',
  DELETE_CONFIRMATION: 'Are you sure you want to delete this item? This action cannot be undone.',
  CLEAR_FORM: 'This will clear all form data. Are you sure?',
  
  // File warnings
  LARGE_FILE_WARNING: 'This file is quite large and may take some time to upload.',
  FILE_REPLACE_WARNING: 'This will replace your current file. Continue?',
  
  // Account warnings
  ACCOUNT_VERIFICATION_PENDING: 'Your account is pending verification. Some features may be limited.',
  DEMO_ACCOUNT_LIMITATIONS: 'Demo accounts have limited functionality. Register for full access.',
  
  // Security warnings
  PASSWORD_WEAK: 'Your password is weak. Consider using a stronger password.',
  PUBLIC_PITCH_WARNING: 'This pitch will be visible to all platform users. Consider requiring an NDA for protection.',
  
  // Network warnings
  SLOW_CONNECTION: 'Slow internet connection detected. File uploads may take longer.',
  OFFLINE_WARNING: 'You appear to be offline. Changes may not be saved.',
};

// Error messages for specific scenarios
export const ERROR_MESSAGES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to multiple failed attempts.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  
  // Authorization errors
  ACCESS_DENIED: 'You do not have permission to access this resource.',
  NDA_REQUIRED: 'You must sign an NDA to view this content.',
  ACCOUNT_NOT_VERIFIED: 'Your account must be verified to perform this action.',
  
  // Form errors
  FORM_VALIDATION_FAILED: 'Please correct the errors below and try again.',
  REQUIRED_FIELDS_MISSING: 'Please fill in all required fields.',
  INVALID_FILE_FORMAT: 'Invalid file format. Please check the allowed file types.',
  
  // Network/Server errors
  CONNECTION_FAILED: 'Connection failed. Please check your internet connection.',
  SERVER_UNAVAILABLE: 'Server is currently unavailable. Please try again later.',
  REQUEST_TIMEOUT: 'Request timed out. Please try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
  
  // Data errors
  PITCH_NOT_FOUND: 'Pitch not found or has been removed.',
  USER_NOT_FOUND: 'User not found.',
  COMPANY_NOT_FOUND: 'Company not found.',
  
  // File upload errors
  UPLOAD_FAILED: 'File upload failed. Please try again.',
  FILE_CORRUPTED: 'File appears to be corrupted. Please try uploading again.',
  STORAGE_FULL: 'Storage limit reached. Please delete some files and try again.',
  
  // General errors
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.',
  FEATURE_UNAVAILABLE: 'This feature is currently unavailable.',
  MAINTENANCE_MODE: 'The system is currently under maintenance. Please try again later.',
};

// Toast message configurations
export const TOAST_CONFIG = {
  SUCCESS: {
    duration: 5000,
    type: 'success' as const,
  },
  ERROR: {
    duration: 8000,
    type: 'error' as const,
  },
  WARNING: {
    duration: 6000,
    type: 'warning' as const,
  },
  INFO: {
    duration: 4000,
    type: 'info' as const,
  },
};

// Accessibility messages
export const A11Y_MESSAGES = {
  // Screen reader announcements
  FORM_SUBMITTED: 'Form has been submitted successfully',
  FORM_ERROR: 'Form contains errors. Please review and correct them.',
  FIELD_REQUIRED: 'Required field',
  FIELD_OPTIONAL: 'Optional field',
  FIELD_INVALID: 'Invalid input',
  
  // Loading announcements
  LOADING: 'Loading content',
  LOADED: 'Content loaded',
  
  // Navigation announcements
  PAGE_CHANGED: (pageName: string) => `Navigated to ${pageName} page`,
  MODAL_OPENED: 'Modal dialog opened',
  MODAL_CLOSED: 'Modal dialog closed',
  
  // Action confirmations
  FILE_SELECTED: (fileName: string) => `File selected: ${fileName}`,
  FILE_REMOVED: 'File removed',
  OPTION_SELECTED: (option: string) => `Selected: ${option}`,
  
  // Error announcements
  ERROR_OCCURRED: 'An error has occurred',
  FIELD_ERROR: (fieldName: string, error: string) => `${fieldName}: ${error}`,
  
  // Button descriptions
  UPLOAD_BUTTON: 'Choose file to upload',
  REMOVE_FILE_BUTTON: 'Remove selected file',
  SUBMIT_BUTTON: 'Submit form',
  CANCEL_BUTTON: 'Cancel and discard changes',
  
  // Instructions
  PASSWORD_INSTRUCTIONS: 'Password must contain at least 8 characters including uppercase, lowercase, and number',
  FILE_UPLOAD_INSTRUCTIONS: 'Drag and drop file here or click to browse',
  FORM_INSTRUCTIONS: 'Fill out all required fields marked with an asterisk',
};

// Form labels and placeholders
export const FORM_LABELS = {
  // Authentication forms
  EMAIL: 'Email',
  PASSWORD: 'Password',
  CONFIRM_PASSWORD: 'Confirm Password',
  USERNAME: 'Username',
  REMEMBER_ME: 'Remember me',
  
  // Pitch creation form
  TITLE: 'Title',
  GENRE: 'Genre',
  FORMAT_CATEGORY: 'Format Category',
  FORMAT_SUBTYPE: 'Format Subtype',
  CUSTOM_FORMAT: 'Custom Format',
  LOGLINE: 'Logline',
  SHORT_SYNOPSIS: 'Short Synopsis',
  COVER_IMAGE: 'Cover Image',
  SCRIPT_PDF: 'Script/Treatment (PDF)',
  PITCH_VIDEO: 'Pitch Video',
  REQUIRE_NDA: 'Require NDA Agreement',
  
  // Company registration
  COMPANY_NAME: 'Company Name',
  REGISTRATION_NUMBER: 'Registration Number',
  COMPANY_WEBSITE: 'Company Website',
  COMPANY_EMAIL: 'Company Email',
  COMPANY_PHONE: 'Company Phone',
  COMPANY_ADDRESS: 'Company Address',
  CITY: 'City',
  STATE_PROVINCE: 'State/Province',
  ZIP_CODE: 'ZIP/Postal Code',
  COUNTRY: 'Country',
  
  // Representative info
  FIRST_NAME: 'First Name',
  LAST_NAME: 'Last Name',
  POSITION_TITLE: 'Position/Title',
  
  // Social media
  LINKEDIN_URL: 'LinkedIn URL',
  TWITTER_URL: 'Twitter/X URL',
  INSTAGRAM_URL: 'Instagram URL',
  FACEBOOK_URL: 'Facebook URL',
  
  // Agreements
  AGREE_TO_TERMS: 'I agree to the Terms of Service and Privacy Policy',
  AGREE_TO_VETTING: 'I understand and agree to the verification process',
};

// Placeholder text
export const PLACEHOLDERS = {
  EMAIL: 'creator@example.com',
  PASSWORD: '••••••••',
  COMPANY_EMAIL: 'info@yourcompany.com',
  PHONE: '+1 (555) 123-4567',
  WEBSITE: 'https://www.yourcompany.com',
  TITLE: 'Enter your project title',
  LOGLINE: 'A one-sentence summary of your story (max 2-3 sentences)',
  SYNOPSIS: 'Provide a brief overview of your story, main characters, and key plot points (1-2 paragraphs)',
  ADDRESS: 'Street Address',
  CITY: 'City',
  STATE: 'State/Province',
  ZIP: 'ZIP/Postal Code',
  COUNTRY: 'Country',
  POSITION: 'Head of Development',
  USERNAME: 'companyname_prod',
  CUSTOM_FORMAT: 'Please specify your custom format',
  REGISTRATION_NUMBER: '123456789',
  COMPANY_NAME: 'Warner Bros. Pictures',
  LINKEDIN: 'LinkedIn URL',
  TWITTER: 'Twitter/X URL',
  INSTAGRAM: 'Instagram URL',
  FACEBOOK: 'Facebook URL',
};

// Export all message categories
export const MESSAGES = {
  VALIDATION: VALIDATION_MESSAGES,
  SUCCESS: SUCCESS_MESSAGES,
  INFO: INFO_MESSAGES,
  WARNING: WARNING_MESSAGES,
  ERROR: ERROR_MESSAGES,
  A11Y: A11Y_MESSAGES,
  LABELS: FORM_LABELS,
  PLACEHOLDERS,
  TOAST_CONFIG,
};