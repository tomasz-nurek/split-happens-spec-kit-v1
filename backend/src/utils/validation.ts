/**
 * Input validation utilities for the expense sharing application
 * 
 * This module provides centralized validation functions based on the business rules
 * defined in specs/001-expense-sharing-mvp/data-model.md
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationOptions {
  required?: boolean;
  allowEmpty?: boolean;
}

/**
 * Validates a string field according to specified constraints
 */
export function validateString(
  value: unknown,
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 255,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const { required = true, allowEmpty = false } = options;

  // Check if value exists
  if (value === null || value === undefined) {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { isValid: errors.length === 0, errors };
  }

  // Check if value is a string
  if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
    return { isValid: false, errors };
  }

  // Check empty string
  if (value.trim() === '') {
    if (!allowEmpty) {
      errors.push(`${fieldName} cannot be empty or whitespace only`);
    }
    return { isValid: errors.length === 0, errors };
  }

  // Check length constraints
  if (value.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} character${minLength === 1 ? '' : 's'} long`);
  }

  if (value.length > maxLength) {
    errors.push(`${fieldName} must be at most ${maxLength} character${maxLength === 1 ? '' : 's'} long`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a numeric amount (for expenses)
 */
export function validateAmount(value: unknown, fieldName: string = 'Amount'): ValidationResult {
  const errors: string[] = [];

  // Check if value exists
  if (value === null || value === undefined) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // Check if value is a number
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
    return { isValid: false, errors };
  }

  // Check if positive
  if (value <= 0) {
    errors.push(`${fieldName} must be positive`);
  }

  // Check decimal places (max 2 for currency)
  const decimalPlaces = (value.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push(`${fieldName} must have at most 2 decimal places`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a split amount (can be zero, for partial expense participation)
 */
export function validateSplitAmount(value: unknown, fieldName: string = 'Split amount'): ValidationResult {
  const errors: string[] = [];

  // Check if value exists
  if (value === null || value === undefined) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // Check if value is a number
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
    return { isValid: false, errors };
  }

  // Check if non-negative (can be zero)
  if (value < 0) {
    errors.push(`${fieldName} must be positive or zero`);
  }

  // Check decimal places (max 2 for currency)
  const decimalPlaces = (value.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push(`${fieldName} must have at most 2 decimal places`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a positive integer ID
 */
export function validateId(value: unknown, fieldName: string = 'ID'): ValidationResult {
  const errors: string[] = [];

  // Check if value exists
  if (value === null || value === undefined) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // Check if value is a number
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
    return { isValid: false, errors };
  }

  // Check if positive integer
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${fieldName} must be a positive integer`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates an array of IDs
 */
export function validateIdArray(value: unknown, fieldName: string = 'ID array'): ValidationResult {
  const errors: string[] = [];

  // Check if value exists
  if (value === null || value === undefined) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // Check if value is an array
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be an array`);
    return { isValid: false, errors };
  }

  // Check if array is not empty
  if (value.length === 0) {
    errors.push(`${fieldName} cannot be empty`);
    return { isValid: false, errors };
  }

  // Validate each ID in the array
  for (let i = 0; i < value.length; i++) {
    const idValidation = validateId(value[i], `${fieldName}[${i}]`);
    if (!idValidation.isValid) {
      errors.push(...idValidation.errors);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates activity log action values
 */
export function validateActivityAction(value: unknown): ValidationResult {
  const validActions = ['CREATE', 'DELETE'];
  const errors: string[] = [];

  if (value === null || value === undefined) {
    errors.push('Action is required');
    return { isValid: false, errors };
  }

  if (typeof value !== 'string') {
    errors.push('Action must be a string');
    return { isValid: false, errors };
  }

  if (!validActions.includes(value)) {
    errors.push(`Action must be one of: ${validActions.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates activity log entity type values
 */
export function validateEntityType(value: unknown): ValidationResult {
  const validEntityTypes = ['expense', 'user', 'group'];
  const errors: string[] = [];

  if (value === null || value === undefined) {
    errors.push('Entity type is required');
    return { isValid: false, errors };
  }

  if (typeof value !== 'string') {
    errors.push('Entity type must be a string');
    return { isValid: false, errors };
  }

  if (!validEntityTypes.includes(value)) {
    errors.push(`Entity type must be one of: ${validEntityTypes.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates user name according to business rules
 */
export function validateUserName(value: unknown): ValidationResult {
  return validateString(value, 'Name', 1, 100);
}

/**
 * Validates group name according to business rules
 */
export function validateGroupName(value: unknown): ValidationResult {
  return validateString(value, 'Name', 1, 100);
}

/**
 * Validates expense description according to business rules
 */
export function validateExpenseDescription(value: unknown): ValidationResult {
  return validateString(value, 'Description', 1, 500);
}

/**
 * Validates that expense splits sum equals the total expense amount
 */
export function validateSplitSum(expenseAmount: number, splits: number[]): ValidationResult {
  const errors: string[] = [];

  const splitSum = splits.reduce((sum, split) => sum + split, 0);
  
  // Allow for small floating point rounding differences (within 0.01)
  const difference = Math.abs(expenseAmount - splitSum);
  if (difference > 0.01) {
    errors.push(`Sum of splits (${splitSum.toFixed(2)}) must equal expense amount (${expenseAmount.toFixed(2)})`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates that a user array contains no duplicates
 */
export function validateNoDuplicateIds(ids: number[], fieldName: string = 'IDs'): ValidationResult {
  const errors: string[] = [];
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  if (duplicates.size > 0) {
    errors.push(`${fieldName} contains duplicates: ${Array.from(duplicates).join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Helper function to combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: string[] = [];

  for (const result of results) {
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  return { isValid: allErrors.length === 0, errors: allErrors };
}

/**
 * Helper function to format validation errors for API responses
 */
export function formatValidationErrors(result: ValidationResult): { error: string } | null {
  if (result.isValid) {
    return null;
  }

  return { error: result.errors.join('; ') };
}