/**
 * React hook for form validation using Valibot schemas
 * Provides real-time validation with debouncing and field-level error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as v from 'valibot';

interface UseFormValidationOptions<T> {
  schema: v.BaseSchema<any, T, any>;
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
  debounceMs?: number;
  validateOnMount?: boolean;
}

interface ValidationState {
  isValid: boolean;
  isValidating: boolean;
  errors: Record<string, string[]>;
  touchedFields: Set<string>;
}

export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  options: UseFormValidationOptions<T>
) {
  const {
    schema,
    mode = 'onBlur',
    debounceMs = 300,
    validateOnMount = false,
  } = options;

  const [data, setData] = useState<T>(initialData);
  const [validationState, setValidationState] = useState<ValidationState>({
    isValid: true,
    isValidating: false,
    errors: {},
    touchedFields: new Set(),
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validate entire form
  const validateForm = useCallback(
    async (formData: T): Promise<{ isValid: boolean; errors: Record<string, string[]> }> => {
      try {
        await v.parseAsync(schema, formData);
        return { isValid: true, errors: {} };
      } catch (error) {
        if (v.isValiError(error)) {
          const errors: Record<string, string[]> = {};
          
          for (const issue of error.issues) {
            const path = issue.path?.[0]?.key as string || 'general';
            if (!errors[path]) {
              errors[path] = [];
            }
            errors[path].push(issue.message);
          }
          
          return { isValid: false, errors };
        }
        
        return {
          isValid: false,
          errors: { general: ['Validation failed'] },
        };
      }
    },
    [schema]
  );

  // Validate single field
  const validateField = useCallback(
    async (fieldName: string, value: any): Promise<string[]> => {
      // Try to validate just this field by creating a partial object
      const partialData = { ...data, [fieldName]: value };
      const result = await validateForm(partialData as T);
      return result.errors[fieldName] || [];
    },
    [data, validateForm]
  );

  // Handle field change with debounced validation
  const handleFieldChange = useCallback(
    (fieldName: keyof T) => async (value: T[keyof T]) => {
      // Update data immediately
      setData((prev) => ({ ...prev, [fieldName]: value }));

      // Mark field as touched if in onChange mode
      if (mode === 'onChange') {
        setValidationState((prev) => ({
          ...prev,
          touchedFields: new Set([...prev.touchedFields, fieldName as string]),
        }));
      }

      // Cancel previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Only validate onChange if mode is onChange
      if (mode === 'onChange') {
        setValidationState((prev) => ({ ...prev, isValidating: true }));

        debounceTimerRef.current = setTimeout(async () => {
          const errors = await validateField(fieldName as string, value);
          
          setValidationState((prev) => ({
            ...prev,
            isValidating: false,
            errors: {
              ...prev.errors,
              [fieldName]: errors,
            },
          }));
        }, debounceMs);
      }
    },
    [mode, debounceMs, validateField]
  );

  // Handle field blur
  const handleFieldBlur = useCallback(
    (fieldName: keyof T) => async () => {
      // Mark field as touched
      setValidationState((prev) => ({
        ...prev,
        touchedFields: new Set([...prev.touchedFields, fieldName as string]),
      }));

      // Validate on blur if mode is onBlur
      if (mode === 'onBlur') {
        const errors = await validateField(fieldName as string, data[fieldName]);
        
        setValidationState((prev) => ({
          ...prev,
          errors: {
            ...prev.errors,
            [fieldName]: errors,
          },
        }));
      }
    },
    [mode, data, validateField]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (onSuccess: (data: T) => void | Promise<void>) => {
      setValidationState((prev) => ({ ...prev, isValidating: true }));

      const result = await validateForm(data);
      
      // Mark all fields as touched
      const allFields = Object.keys(data);
      setValidationState((prev) => ({
        ...prev,
        isValid: result.isValid,
        isValidating: false,
        errors: result.errors,
        touchedFields: new Set(allFields),
      }));

      if (result.isValid) {
        await onSuccess(data);
      }

      return result.isValid;
    },
    [data, validateForm]
  );

  // Reset form
  const reset = useCallback(
    (newData?: Partial<T>) => {
      setData(newData ? { ...initialData, ...newData } : initialData);
      setValidationState({
        isValid: true,
        isValidating: false,
        errors: {},
        touchedFields: new Set(),
      });
    },
    [initialData]
  );

  // Validate on mount if requested
  useEffect(() => {
    if (validateOnMount) {
      void validateForm(data).then((result) => {
        setValidationState((prev) => ({
          ...prev,
          isValid: result.isValid,
          errors: result.errors,
        }));
      });
    }
  }, [validateOnMount]); // Only run on mount

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Get field-specific props
  const getFieldProps = useCallback(
    (fieldName: keyof T) => ({
      value: data[fieldName],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleFieldChange(fieldName)(e.target.value as T[keyof T]),
      onBlur: handleFieldBlur(fieldName),
      error: validationState.touchedFields.has(fieldName as string)
        ? validationState.errors[fieldName as string]
        : undefined,
      'aria-invalid': validationState.touchedFields.has(fieldName as string) &&
        validationState.errors[fieldName as string]?.length > 0,
      'aria-describedby': validationState.errors[fieldName as string]?.length > 0
        ? `${String(fieldName)}-error`
        : undefined,
    }),
    [data, handleFieldChange, handleFieldBlur, validationState]
  );

  // Get field value
  const getValue = useCallback(
    (fieldName: keyof T): T[keyof T] => data[fieldName],
    [data]
  );

  // Set field value directly
  const setValue = useCallback(
    (fieldName: keyof T, value: T[keyof T]) => {
      setData((prev) => ({ ...prev, [fieldName]: value }));
    },
    []
  );

  // Set multiple values
  const setValues = useCallback(
    (values: Partial<T>) => {
      setData((prev) => ({ ...prev, ...values }));
    },
    []
  );

  return {
    // Data
    data,
    setData,
    getValue,
    setValue,
    setValues,
    
    // Validation state
    errors: validationState.errors,
    isValid: validationState.isValid,
    isValidating: validationState.isValidating,
    touchedFields: validationState.touchedFields,
    
    // Field helpers
    getFieldProps,
    handleFieldChange,
    handleFieldBlur,
    
    // Form actions
    handleSubmit,
    validateForm: () => validateForm(data),
    validateField,
    reset,
    
    // Field error helpers
    getFieldError: (fieldName: keyof T): string[] =>
      validationState.touchedFields.has(fieldName as string)
        ? validationState.errors[fieldName as string] || []
        : [],
    hasFieldError: (fieldName: keyof T): boolean =>
      validationState.touchedFields.has(fieldName as string) &&
      (validationState.errors[fieldName as string]?.length || 0) > 0,
    clearFieldError: (fieldName: keyof T) => {
      setValidationState((prev) => {
        const newErrors = { ...prev.errors };
        delete newErrors[fieldName as string];
        return { ...prev, errors: newErrors };
      });
    },
  };
}