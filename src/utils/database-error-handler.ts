/**
 * Database Error Handler
 * Converts database errors into user-friendly error messages
 */

import { errorResponse, validationErrorResponse, serverErrorResponse } from "./response.ts";

export interface DatabaseError {
  code?: string;
  message?: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
  severity?: string;
  routine?: string;
}

export interface UserFriendlyError {
  message: string;
  statusCode: number;
  field?: string;
  suggestedAction?: string;
}

/**
 * Convert database errors to user-friendly messages
 */
export function parseDatabaseError(error: any): UserFriendlyError {
  // Handle different types of error objects
  let dbError: DatabaseError = {};
  
  if (error && typeof error === 'object') {
    dbError = {
      code: error.code || error.error_code,
      message: error.message,
      constraint: error.constraint_name || error.constraint,
      detail: error.detail,
      table: error.table_name || error.table,
      column: error.column_name || error.column,
      severity: error.severity,
      routine: error.routine
    };
  }

  const code = dbError.code;
  const message = dbError.message?.toLowerCase() || '';
  const constraint = dbError.constraint?.toLowerCase() || '';
  const detail = dbError.detail?.toLowerCase() || '';

  // PostgreSQL error codes mapping
  switch (code) {
    // Unique constraint violation
    case '23505':
      return handleUniqueConstraintViolation(dbError);
    
    // Foreign key constraint violation
    case '23503':
      return handleForeignKeyViolation(dbError);
    
    // Not null constraint violation
    case '23502':
      return handleNotNullViolation(dbError);
    
    // Check constraint violation
    case '23514':
      return handleCheckConstraintViolation(dbError);
    
    // Invalid text representation (bad data type)
    case '22P02':
      return {
        message: 'Invalid data format provided',
        statusCode: 400,
        suggestedAction: 'Please check the data types of your input fields'
      };
    
    // String data too long
    case '22001':
      return {
        message: 'Input data is too long for the field',
        statusCode: 400,
        suggestedAction: 'Please reduce the length of your input'
      };
    
    // Connection errors
    case '08000':
    case '08003':
    case '08006':
      return {
        message: 'Database connection issue',
        statusCode: 503,
        suggestedAction: 'Please try again in a moment'
      };
    
    // Insufficient privilege
    case '42501':
      return {
        message: 'Access denied',
        statusCode: 403,
        suggestedAction: 'You do not have permission to perform this action'
      };
    
    // Undefined table
    case '42P01':
      return {
        message: 'Service temporarily unavailable',
        statusCode: 503,
        suggestedAction: 'Please try again later'
      };
    
    default:
      // Handle common error patterns in the message
      if (message.includes('duplicate key')) {
        return handleDuplicateKeyError(message, detail);
      }
      
      if (message.includes('foreign key')) {
        return handleGenericForeignKeyError(message);
      }
      
      // Postgres emits "violates not-null constraint" (hyphen); also accept the
      // spaced form "not null" for hand-rolled / non-PG error strings.
      if (message.includes('not null') || message.includes('not-null')) {
        return handleGenericNotNullError(message);
      }
      
      if (message.includes('timeout') || message.includes('deadlock')) {
        return {
          message: 'Operation timed out due to high server load',
          statusCode: 503,
          suggestedAction: 'Please try again in a moment'
        };
      }
      
      // Generic fallback
      return {
        message: 'A database error occurred',
        statusCode: 500,
        suggestedAction: 'Please try again or contact support if the problem persists'
      };
  }
}

/**
 * Handle unique constraint violations
 */
function handleUniqueConstraintViolation(dbError: DatabaseError): UserFriendlyError {
  const constraint = dbError.constraint?.toLowerCase() || '';
  const detail = dbError.detail?.toLowerCase() || '';
  
  // Email uniqueness
  if (constraint.includes('email') || detail.includes('email')) {
    return {
      message: 'An account with this email address already exists',
      statusCode: 409,
      field: 'email',
      suggestedAction: 'Please use a different email address or try logging in'
    };
  }
  
  // Username uniqueness
  if (constraint.includes('username') || detail.includes('username')) {
    return {
      message: 'This username is already taken',
      statusCode: 409,
      field: 'username',
      suggestedAction: 'Please choose a different username'
    };
  }
  
  // Pitch title uniqueness (for same creator)
  if (constraint.includes('title') || detail.includes('title')) {
    return {
      message: 'You already have a pitch with this title',
      statusCode: 409,
      field: 'title',
      suggestedAction: 'Please use a different title for your pitch'
    };
  }
  
  // Company name uniqueness
  if (constraint.includes('company') || detail.includes('company')) {
    return {
      message: 'This company name is already registered',
      statusCode: 409,
      field: 'companyName',
      suggestedAction: 'Please use a different company name'
    };
  }
  
  // Generic unique constraint
  return {
    message: 'This value is already in use',
    statusCode: 409,
    suggestedAction: 'Please use a different value'
  };
}

/**
 * Handle foreign key constraint violations
 */
function handleForeignKeyViolation(dbError: DatabaseError): UserFriendlyError {
  const detail = dbError.detail?.toLowerCase() || '';
  
  if (detail.includes('user') || detail.includes('creator') || detail.includes('investor')) {
    return {
      message: 'User not found or no longer exists',
      statusCode: 400,
      suggestedAction: 'Please refresh the page and try again'
    };
  }
  
  if (detail.includes('pitch')) {
    return {
      message: 'Pitch not found or no longer available',
      statusCode: 400,
      suggestedAction: 'Please refresh the page and select a valid pitch'
    };
  }
  
  if (detail.includes('message') || detail.includes('conversation')) {
    return {
      message: 'Message or conversation not found',
      statusCode: 400,
      suggestedAction: 'Please refresh the page and try again'
    };
  }
  
  return {
    message: 'Referenced item no longer exists',
    statusCode: 400,
    suggestedAction: 'Please refresh the page and try again'
  };
}

/**
 * Handle not null constraint violations
 */
function handleNotNullViolation(dbError: DatabaseError): UserFriendlyError {
  const column = dbError.column?.toLowerCase() || '';
  
  const fieldMappings: Record<string, { name: string; message: string }> = {
    'email': { name: 'email', message: 'Email address is required' },
    'password': { name: 'password', message: 'Password is required' },
    'username': { name: 'username', message: 'Username is required' },
    'title': { name: 'title', message: 'Title is required' },
    'description': { name: 'description', message: 'Description is required' },
    'budget': { name: 'budget', message: 'Budget is required' },
    'user_id': { name: 'userId', message: 'User identification is required' },
    'creator_id': { name: 'creatorId', message: 'Creator identification is required' },
    'pitch_id': { name: 'pitchId', message: 'Pitch identification is required' }
  };
  
  const fieldInfo = fieldMappings[column];
  if (fieldInfo) {
    return {
      message: fieldInfo.message,
      statusCode: 400,
      field: fieldInfo.name,
      suggestedAction: 'Please provide all required information'
    };
  }
  
  return {
    message: 'Required field is missing',
    statusCode: 400,
    suggestedAction: 'Please provide all required information'
  };
}

/**
 * Handle check constraint violations
 */
function handleCheckConstraintViolation(dbError: DatabaseError): UserFriendlyError {
  const constraint = dbError.constraint?.toLowerCase() || '';
  
  if (constraint.includes('budget') || constraint.includes('amount')) {
    return {
      message: 'Budget amount must be a positive number',
      statusCode: 400,
      field: 'budget',
      suggestedAction: 'Please enter a valid positive amount'
    };
  }
  
  if (constraint.includes('email') || constraint.includes('format')) {
    return {
      message: 'Invalid email format',
      statusCode: 400,
      field: 'email',
      suggestedAction: 'Please enter a valid email address'
    };
  }
  
  if (constraint.includes('user_type') || constraint.includes('usertype')) {
    return {
      message: 'Invalid user type selected',
      statusCode: 400,
      field: 'userType',
      suggestedAction: 'Please select a valid user type (creator, investor, or production)'
    };
  }
  
  return {
    message: 'Invalid data provided',
    statusCode: 400,
    suggestedAction: 'Please check your input and try again'
  };
}

/**
 * Handle duplicate key errors from message parsing
 */
function handleDuplicateKeyError(message: string, detail: string): UserFriendlyError {
  if (message.includes('email') || detail.includes('email')) {
    return {
      message: 'An account with this email address already exists',
      statusCode: 409,
      field: 'email',
      suggestedAction: 'Please use a different email address or try logging in'
    };
  }
  
  return {
    message: 'This information is already in use',
    statusCode: 409,
    suggestedAction: 'Please use different values'
  };
}

/**
 * Handle generic foreign key errors from message parsing
 */
function handleGenericForeignKeyError(message: string): UserFriendlyError {
  return {
    message: 'Referenced item not found',
    statusCode: 400,
    suggestedAction: 'Please refresh the page and try again'
  };
}

/**
 * Handle generic not null errors from message parsing
 */
function handleGenericNotNullError(message: string): UserFriendlyError {
  return {
    message: 'Required information is missing',
    statusCode: 400,
    suggestedAction: 'Please provide all required fields'
  };
}

/**
 * Convert database error to appropriate HTTP response
 */
export function handleDatabaseError(error: any, origin?: string): Response {
  console.error('Database error occurred:', error);
  
  const userError = parseDatabaseError(error);
  
  // Use appropriate response function based on status code
  switch (userError.statusCode) {
    case 400:
      if (userError.field) {
        return validationErrorResponse(userError.field, userError.message, origin);
      }
      return validationErrorResponse(userError.message, origin);
    
    case 409:
      return errorResponse(userError.message, 409, {
        code: 'CONFLICT',
        field: userError.field,
        details: userError.suggestedAction
      }, origin);
    
    case 403:
      return errorResponse(userError.message, 403, {
        code: 'FORBIDDEN',
        details: userError.suggestedAction
      }, origin);
    
    case 503:
      return errorResponse(userError.message, 503, {
        code: 'SERVICE_UNAVAILABLE',
        details: userError.suggestedAction
      }, origin);
    
    default:
      return serverErrorResponse(userError.message, undefined, origin);
  }
}

/**
 * Wrapper for database operations with error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  origin?: string
): Promise<T | Response> {
  try {
    return await operation();
  } catch (error) {
    return handleDatabaseError(error, origin);
  }
}