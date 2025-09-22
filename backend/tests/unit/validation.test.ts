import { describe, it, expect } from 'vitest';
import {
  validateString,
  validateAmount,
  validateSplitAmount,
  validateId,
  validateIdArray,
  validateActivityAction,
  validateEntityType,
  validateUserName,
  validateGroupName,
  validateExpenseDescription,
  validateSplitSum,
  validateNoDuplicateIds,
  combineValidationResults,
  formatValidationErrors,
  ValidationResult
} from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateString', () => {
    it('should validate valid strings', () => {
      const result = validateString('Valid name', 'Name', 1, 100);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null values when required', () => {
      const result = validateString(null, 'Name', 1, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should reject undefined values when required', () => {
      const result = validateString(undefined, 'Name', 1, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should accept null/undefined when not required', () => {
      const result = validateString(null, 'Name', 1, 100, { required: false });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject non-string values', () => {
      const result = validateString(123, 'Name', 1, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should reject empty strings by default', () => {
      const result = validateString('   ', 'Name', 1, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name cannot be empty or whitespace only');
    });

    it('should accept empty strings when allowEmpty is true', () => {
      const result = validateString('   ', 'Name', 1, 100, { allowEmpty: true });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should enforce minimum length', () => {
      const result = validateString('a', 'Name', 3, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be at least 3 characters long');
    });

    it('should enforce maximum length', () => {
      const result = validateString('a'.repeat(101), 'Name', 1, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be at most 100 characters long');
    });

    it('should handle singular form for length 1', () => {
      const result = validateString('', 'Name', 1, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name cannot be empty or whitespace only');
    });
  });

  describe('validateAmount', () => {
    it('should validate positive numbers', () => {
      const result = validateAmount(10.50);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null/undefined', () => {
      const result = validateAmount(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount is required');
    });

    it('should reject non-numbers', () => {
      const result = validateAmount('10.50');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be a valid number');
    });

    it('should reject NaN', () => {
      const result = validateAmount(NaN);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be a valid number');
    });

    it('should reject zero', () => {
      const result = validateAmount(0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be positive');
    });

    it('should reject negative numbers', () => {
      const result = validateAmount(-5.00);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be positive');
    });

    it('should reject more than 2 decimal places', () => {
      const result = validateAmount(10.123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must have at most 2 decimal places');
    });

    it('should accept amounts with 2 decimal places', () => {
      const result = validateAmount(10.12);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept amounts with 1 decimal place', () => {
      const result = validateAmount(10.1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept whole numbers', () => {
      const result = validateAmount(10);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should use custom field name', () => {
      const result = validateAmount(null, 'Custom Amount');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Custom Amount is required');
    });
  });

  describe('validateSplitAmount', () => {
    it('should validate positive numbers', () => {
      const result = validateSplitAmount(10.50);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept zero', () => {
      const result = validateSplitAmount(0);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject negative numbers', () => {
      const result = validateSplitAmount(-5.00);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Split amount must be positive or zero');
    });

    it('should reject more than 2 decimal places', () => {
      const result = validateSplitAmount(10.123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Split amount must have at most 2 decimal places');
    });
  });

  describe('validateId', () => {
    it('should validate positive integers', () => {
      const result = validateId(5);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null/undefined', () => {
      const result = validateId(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID is required');
    });

    it('should reject non-numbers', () => {
      const result = validateId('5');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID must be a valid number');
    });

    it('should reject zero', () => {
      const result = validateId(0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID must be a positive integer');
    });

    it('should reject negative numbers', () => {
      const result = validateId(-5);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID must be a positive integer');
    });

    it('should reject floating point numbers', () => {
      const result = validateId(5.5);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID must be a positive integer');
    });

    it('should use custom field name', () => {
      const result = validateId(null, 'User ID');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User ID is required');
    });
  });

  describe('validateIdArray', () => {
    it('should validate array of positive integers', () => {
      const result = validateIdArray([1, 2, 3]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null/undefined', () => {
      const result = validateIdArray(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID array is required');
    });

    it('should reject non-arrays', () => {
      const result = validateIdArray('not an array');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID array must be an array');
    });

    it('should reject empty arrays', () => {
      const result = validateIdArray([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID array cannot be empty');
    });

    it('should reject arrays with invalid IDs', () => {
      const result = validateIdArray([1, 'invalid', 3]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID array[1] must be a valid number');
    });

    it('should reject arrays with zero or negative IDs', () => {
      const result = validateIdArray([1, 0, -1]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID array[1] must be a positive integer');
      expect(result.errors).toContain('ID array[2] must be a positive integer');
    });

    it('should use custom field name', () => {
      const result = validateIdArray([], 'Participant IDs');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Participant IDs cannot be empty');
    });
  });

  describe('validateActivityAction', () => {
    it('should validate CREATE action', () => {
      const result = validateActivityAction('CREATE');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate DELETE action', () => {
      const result = validateActivityAction('DELETE');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid actions', () => {
      const result = validateActivityAction('UPDATE');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action must be one of: CREATE, DELETE');
    });

    it('should reject null/undefined', () => {
      const result = validateActivityAction(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action is required');
    });

    it('should reject non-strings', () => {
      const result = validateActivityAction(123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action must be a string');
    });
  });

  describe('validateEntityType', () => {
    it('should validate expense entity type', () => {
      const result = validateEntityType('expense');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate user entity type', () => {
      const result = validateEntityType('user');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate group entity type', () => {
      const result = validateEntityType('group');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid entity types', () => {
      const result = validateEntityType('invalid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entity type must be one of: expense, user, group');
    });

    it('should reject null/undefined', () => {
      const result = validateEntityType(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entity type is required');
    });
  });

  describe('validateUserName', () => {
    it('should validate valid user names', () => {
      const result = validateUserName('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should enforce 100 character limit', () => {
      const result = validateUserName('a'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be at most 100 characters long');
    });

    it('should require at least 1 character', () => {
      const result = validateUserName('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name cannot be empty or whitespace only');
    });
  });

  describe('validateGroupName', () => {
    it('should validate valid group names', () => {
      const result = validateGroupName('Weekend Trip');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should enforce 100 character limit', () => {
      const result = validateGroupName('a'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be at most 100 characters long');
    });
  });

  describe('validateExpenseDescription', () => {
    it('should validate valid descriptions', () => {
      const result = validateExpenseDescription('Dinner at restaurant');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should enforce 500 character limit', () => {
      const result = validateExpenseDescription('a'.repeat(501));
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be at most 500 characters long');
    });

    it('should require at least 1 character', () => {
      const result = validateExpenseDescription('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description cannot be empty or whitespace only');
    });
  });

  describe('validateSplitSum', () => {
    it('should validate exact matches', () => {
      const result = validateSplitSum(30.00, [10.00, 10.00, 10.00]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should allow small floating point differences', () => {
      const result = validateSplitSum(30.00, [10.00, 10.00, 9.999]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject significant differences', () => {
      const result = validateSplitSum(30.00, [10.00, 10.00, 9.00]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sum of splits (29.00) must equal expense amount (30.00)');
    });

    it('should handle empty splits array', () => {
      const result = validateSplitSum(30.00, []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sum of splits (0.00) must equal expense amount (30.00)');
    });
  });

  describe('validateNoDuplicateIds', () => {
    it('should validate arrays with no duplicates', () => {
      const result = validateNoDuplicateIds([1, 2, 3, 4]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect single duplicate', () => {
      const result = validateNoDuplicateIds([1, 2, 2, 3]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDs contains duplicates: 2');
    });

    it('should detect multiple duplicates', () => {
      const result = validateNoDuplicateIds([1, 2, 2, 3, 3, 4]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDs contains duplicates: 2, 3');
    });

    it('should use custom field name', () => {
      const result = validateNoDuplicateIds([1, 1], 'Participant IDs');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Participant IDs contains duplicates: 1');
    });

    it('should handle empty arrays', () => {
      const result = validateNoDuplicateIds([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('combineValidationResults', () => {
    it('should combine valid results', () => {
      const result1: ValidationResult = { isValid: true, errors: [] };
      const result2: ValidationResult = { isValid: true, errors: [] };
      
      const combined = combineValidationResults(result1, result2);
      expect(combined.isValid).toBe(true);
      expect(combined.errors).toEqual([]);
    });

    it('should combine results with errors', () => {
      const result1: ValidationResult = { isValid: false, errors: ['Error 1'] };
      const result2: ValidationResult = { isValid: false, errors: ['Error 2', 'Error 3'] };
      
      const combined = combineValidationResults(result1, result2);
      expect(combined.isValid).toBe(false);
      expect(combined.errors).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });

    it('should combine mixed results', () => {
      const result1: ValidationResult = { isValid: true, errors: [] };
      const result2: ValidationResult = { isValid: false, errors: ['Error 1'] };
      
      const combined = combineValidationResults(result1, result2);
      expect(combined.isValid).toBe(false);
      expect(combined.errors).toEqual(['Error 1']);
    });

    it('should handle no arguments', () => {
      const combined = combineValidationResults();
      expect(combined.isValid).toBe(true);
      expect(combined.errors).toEqual([]);
    });
  });

  describe('formatValidationErrors', () => {
    it('should return null for valid results', () => {
      const result: ValidationResult = { isValid: true, errors: [] };
      const formatted = formatValidationErrors(result);
      expect(formatted).toBeNull();
    });

    it('should format single error', () => {
      const result: ValidationResult = { isValid: false, errors: ['Single error'] };
      const formatted = formatValidationErrors(result);
      expect(formatted).toEqual({ error: 'Single error' });
    });

    it('should format multiple errors', () => {
      const result: ValidationResult = { isValid: false, errors: ['Error 1', 'Error 2', 'Error 3'] };
      const formatted = formatValidationErrors(result);
      expect(formatted).toEqual({ error: 'Error 1; Error 2; Error 3' });
    });

    it('should handle empty errors array', () => {
      const result: ValidationResult = { isValid: false, errors: [] };
      const formatted = formatValidationErrors(result);
      expect(formatted).toEqual({ error: '' });
    });
  });
});