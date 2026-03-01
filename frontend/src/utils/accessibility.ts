/**
 * Accessibility utilities for the Pitchey application
 * Provides WCAG-compliant helpers for forms, navigation, and user interactions
 */

import { A11Y_MESSAGES } from '@config/messages';

// ARIA attribute builders
export const aria = {
  // Build aria-label attribute
  label: (text: string): { 'aria-label': string } => ({
    'aria-label': text
  }),

  // Build aria-labelledby attribute
  labelledBy: (id: string): { 'aria-labelledby': string } => ({
    'aria-labelledby': id
  }),

  // Build aria-describedby attribute
  describedBy: (id: string): { 'aria-describedby': string } => ({
    'aria-describedby': id
  }),

  // Build aria-expanded attribute for collapsible elements
  expanded: (isExpanded: boolean): { 'aria-expanded': boolean } => ({
    'aria-expanded': isExpanded
  }),

  // Build aria-required attribute for form fields
  required: (isRequired: boolean): { 'aria-required': boolean } => ({
    'aria-required': isRequired
  }),

  // Build aria-invalid attribute for form validation
  invalid: (isInvalid: boolean): { 'aria-invalid': boolean } => ({
    'aria-invalid': isInvalid
  }),

  // Build aria-live attribute for dynamic content
  live: (level: 'polite' | 'assertive' | 'off' = 'polite'): { 'aria-live': string } => ({
    'aria-live': level
  }),

  // Build aria-hidden attribute
  hidden: (isHidden: boolean): { 'aria-hidden': boolean } => ({
    'aria-hidden': isHidden
  }),

  // Build role attribute
  role: (role: string): { role: string } => ({
    role
  }),

  // Build tabindex attribute
  tabIndex: (index: number): { tabIndex: number } => ({
    tabIndex: index
  })
};

// Form field accessibility helpers
export const formField = {
  // Generate complete accessibility attributes for a form field
  getAttributes: (config: {
    id: string;
    label: string;
    required?: boolean;
    invalid?: boolean;
    errorId?: string;
    helpId?: string;
    describedBy?: string[];
  }) => {
    const attributes: Record<string, any> = {
      id: config.id,
      name: config.id,
    };

    // Add required attribute
    if (config.required) {
      attributes['aria-required'] = true;
      attributes.required = true;
    }

    // Add invalid state
    if (config.invalid) {
      attributes['aria-invalid'] = true;
    }

    // Build describedBy from multiple sources
    const describedByIds: string[] = [];
    if (config.helpId) describedByIds.push(config.helpId);
    if (config.errorId && config.invalid) describedByIds.push(config.errorId);
    if (config.describedBy) describedByIds.push(...config.describedBy);
    
    if (describedByIds.length > 0) {
      attributes['aria-describedby'] = describedByIds.join(' ');
    }

    return attributes;
  },

  // Generate label attributes
  getLabelAttributes: (htmlFor: string, required?: boolean) => ({
    htmlFor,
    className: `block text-sm font-medium text-gray-700 mb-2 ${required ? "after:content-['*'] after:text-red-500 after:ml-1" : ''}`
  }),

  // Generate error message attributes
  getErrorAttributes: (fieldId: string) => ({
    id: `${fieldId}-error`,
    role: 'alert',
    'aria-live': 'polite',
    className: 'text-sm text-red-600 mt-1'
  }),

  // Generate help text attributes
  getHelpAttributes: (fieldId: string) => ({
    id: `${fieldId}-help`,
    className: 'text-xs text-gray-500 mt-1'
  })
};

// Button accessibility helpers
export const button = {
  // Generate button attributes based on state
  getAttributes: (config: {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    ariaLabel?: string;
    describedBy?: string;
  }) => {
    const attributes: Record<string, any> = {
      type: config.type || 'button',
    };

    if (config.disabled || config.loading) {
      attributes.disabled = true;
      attributes['aria-disabled'] = true;
    }

    if (config.loading) {
      attributes['aria-busy'] = true;
    }

    if (config.ariaLabel) {
      attributes['aria-label'] = config.ariaLabel;
    }

    if (config.describedBy) {
      attributes['aria-describedby'] = config.describedBy;
    }

    return attributes;
  }
};

// File upload accessibility helpers
export const fileUpload = {
  // Generate file input attributes
  getInputAttributes: (config: {
    id: string;
    accept?: string;
    multiple?: boolean;
    required?: boolean;
    disabled?: boolean;
  }) => ({
    id: config.id,
    type: 'file',
    accept: config.accept,
    multiple: config.multiple,
    required: config.required,
    disabled: config.disabled,
    'aria-describedby': `${config.id}-instructions`,
    className: 'sr-only' // Visually hidden but accessible
  }),

  // Generate drag and drop zone attributes
  getDropZoneAttributes: (config: {
    isDragActive?: boolean;
    disabled?: boolean;
    labelId: string;
  }) => ({
    role: 'button',
    tabIndex: config.disabled ? -1 : 0,
    'aria-labelledby': config.labelId,
    'aria-disabled': config.disabled,
    'aria-describedby': `${config.labelId}-instructions`,
    className: `border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer
      ${config.isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-500'}
      ${config.disabled ? 'opacity-50 cursor-not-allowed' : ''}
      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2`
  })
};

// Modal/Dialog accessibility helpers
export const modal = {
  // Generate modal container attributes
  getContainerAttributes: (config: {
    isOpen: boolean;
    labelId?: string;
    descriptionId?: string;
  }) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': config.labelId,
    'aria-describedby': config.descriptionId,
    'aria-hidden': !config.isOpen,
    tabIndex: -1
  }),

  // Generate backdrop attributes
  getBackdropAttributes: () => ({
    'aria-hidden': true,
    className: 'fixed inset-0 bg-black bg-opacity-50 transition-opacity'
  })
};

// Navigation accessibility helpers
export const navigation = {
  // Generate navigation attributes
  getNavAttributes: (ariaLabel: string) => ({
    role: 'navigation',
    'aria-label': ariaLabel
  }),

  // Generate breadcrumb attributes
  getBreadcrumbAttributes: () => ({
    'aria-label': 'Breadcrumb navigation',
    role: 'navigation'
  }),

  // Generate link attributes
  getLinkAttributes: (config: {
    href: string;
    isActive?: boolean;
    isExternal?: boolean;
    ariaLabel?: string;
  }) => {
    const attributes: Record<string, any> = {
      href: config.href,
    };

    if (config.isActive) {
      attributes['aria-current'] = 'page';
    }

    if (config.isExternal) {
      attributes.target = '_blank';
      attributes.rel = 'noopener noreferrer';
      attributes['aria-label'] = config.ariaLabel || 'Opens in new tab';
    }

    if (config.ariaLabel) {
      attributes['aria-label'] = config.ariaLabel;
    }

    return attributes;
  }
};

// Live region for announcements
export const announcer = {
  // Create a live region for screen reader announcements
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('a11y-announcer');
    if (announcer) {
      announcer.textContent = message;
      announcer.setAttribute('aria-live', priority);
    }
  },

  // Create the announcer element (call once in app root)
  createAnnouncer: () => {
    if (!document.getElementById('a11y-announcer')) {
      const announcer = document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
    }
  }
};

// Focus management utilities
export const focus = {
  // Focus first focusable element in container
  focusFirst: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    if (firstElement) {
      firstElement.focus();
    }
  },

  // Focus element by ID with fallback
  focusById: (id: string, fallbackSelector?: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.focus();
    } else if (fallbackSelector) {
      const fallback = document.querySelector(fallbackSelector) as HTMLElement;
      if (fallback) {
        fallback.focus();
      }
    }
  },

  // Trap focus within container (for modals)
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }
};

// Keyboard navigation helpers
export const keyboard = {
  // Handle escape key to close modals/dropdowns
  onEscape: (callback: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      callback();
    }
  },

  // Handle enter/space for button-like elements
  onActivate: (callback: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  },

  // Arrow key navigation for lists/menus
  arrowNavigation: (config: {
    items: HTMLElement[];
    currentIndex: number;
    onChange: (newIndex: number) => void;
    loop?: boolean;
  }) => (e: KeyboardEvent) => {
    let newIndex = config.currentIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = config.currentIndex + 1;
        if (newIndex >= config.items.length) {
          newIndex = config.loop ? 0 : config.items.length - 1;
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = config.currentIndex - 1;
        if (newIndex < 0) {
          newIndex = config.loop ? config.items.length - 1 : 0;
        }
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = config.items.length - 1;
        break;
    }

    if (newIndex !== config.currentIndex) {
      config.onChange(newIndex);
      config.items[newIndex]?.focus();
    }
  }
};

// Color contrast and visibility helpers
export const visibility = {
  // Screen reader only class
  srOnly: 'sr-only',
  
  // Focus visible class (for custom focus indicators)
  focusVisible: 'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
  
  // High contrast mode detection
  prefersHighContrast: (): boolean => {
    return window.matchMedia('(prefers-contrast: high)').matches;
  },

  // Reduced motion detection
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
};

// Form validation announcements
export const validation = {
  // Announce form errors to screen readers
  announceErrors: (errors: string[]) => {
    if (errors.length > 0) {
      const message = `${A11Y_MESSAGES.FORM_ERROR} ${errors.join('. ')}`;
      announcer.announce(message, 'assertive');
    }
  },

  // Announce successful form submission
  announceSuccess: (message?: string) => {
    const announcement = message || A11Y_MESSAGES.FORM_SUBMITTED;
    announcer.announce(announcement, 'polite');
  },

  // Announce field validation error
  announceFieldError: (fieldName: string, error: string) => {
    const message = A11Y_MESSAGES.FIELD_ERROR(fieldName, error);
    announcer.announce(message, 'assertive');
  }
};

// Utility to generate unique IDs for accessibility
export const generateId = (prefix: string = 'a11y'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

// Export commonly used CSS classes for accessibility
export const a11yClasses = {
  srOnly: 'sr-only',
  focusVisible: 'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-purple-600 text-white px-4 py-2 rounded-lg z-50',
  errorText: 'text-red-600 text-sm',
  requiredIndicator: "after:content-['*'] after:text-red-500 after:ml-1",
  disabledElement: 'opacity-50 cursor-not-allowed',
};

// Main accessibility utility object
export const a11y = {
  aria,
  formField,
  button,
  fileUpload,
  modal,
  navigation,
  announcer,
  focus,
  keyboard,
  visibility,
  validation,
  generateId,
  classes: a11yClasses,
};

export default a11y;