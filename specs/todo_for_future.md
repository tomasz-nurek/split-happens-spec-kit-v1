# Future Improvements: Critical Technical Debt

This document tracks critical improvements identified during code reviews that should be addressed in future iterations.

## 1. Input Sanitization

**Problem:** Current API endpoints lack proper input validation and sanitization.

**Why Important:**
- Security vulnerability: Potential XSS attacks through unsanitized inputs
- Data integrity: Malformed or malicious data could corrupt the database
- User experience: Better error messages and validation feedback
- Compliance: Helps meet security standards and best practices

**Impact:** High security risk, affects all user-facing endpoints

## 2. Resource Management

**Problem:** Each service creates its own database connection instance.

**Why Important:**
- Performance degradation: Multiple connections per request waste resources
- Connection pool exhaustion: Can lead to database connection limits being hit
- Resource leaks: Improper connection lifecycle management
- Scalability issues: Difficult to optimize database usage under load
- Testing complexity: Hard to mock or control database connections in tests

**Impact:** High performance and reliability risk, affects all database operations

## 3. Dependency Injection

**Problem:** Services are instantiated with hardcoded dependencies at module level.

**Why Important:**
- Testability: Hard to mock dependencies for unit testing
- Maintainability: Tight coupling makes code changes more risky
- Flexibility: Difficult to swap implementations or configurations
- Code reusability: Services can't be easily reused with different dependencies
- Separation of concerns: Business logic mixed with dependency management

**Impact:** Medium maintainability issue, affects development velocity and code quality

## 4. Balance Endpoints Code Quality Improvements

**Problem:** Minor code quality issues identified in T035 balance endpoints implementation.

**Why Important:**
- Defensive programming: Non-null assertions (`!`) could cause runtime errors if assumptions change
- Error handling: Full error objects logged could expose sensitive information in production
- Test coverage: Missing edge cases and explicit data seeding reduces test reliability
- Input validation: Lacks comprehensive schema validation for request parameters
- Performance optimization: Service instantiation patterns could be improved for better memory usage

**Specific Issues:**
- Use of `debtMap.get(debt.from.userId)!` assumes map keys exist without validation
- Console.error logs full error objects which may contain sensitive data
- Missing tests for invalid ID formats (non-numeric strings, special characters)
- No explicit test data seeding - tests depend on existing database state
- Service instances created per module import rather than proper dependency injection
- Missing rate limiting on balance calculation endpoints
- No input schema validation middleware for robust parameter checking

**Impact:** Low to medium maintainability and security risk, affects code robustness and production monitoring

## 5. Activity Endpoint Security and Performance Issues

**Problem:** Security vulnerabilities and performance issues identified in T036 Activity endpoint implementation.

**Why Important:**
- Security: Information disclosure through error messages and missing rate limiting
- Performance: Unbounded queries could cause DoS and database overload
- Reliability: Integration test failures indicate system integration problems
- Data protection: Audit logs are sensitive and need proper access controls

**Specific Issues:**
- **Critical:** Integration tests failing (0/6 passing) - auth format mismatch, 404 routing errors
- **Security:** No rate limiting on activity endpoint - vulnerable to DoS attacks
- **Security:** Error messages too verbose - could leak sensitive information in production
- **Performance:** Missing pagination limits - users can request unlimited data via large limit values
- **Performance:** No database indexing on `created_at` for sorting operations
- **Validation:** Missing edge case handling for array query parameters
- **Validation:** No maximum limit validation (users could request millions of records)
- **Logging:** Console.error exposes full error objects with potential sensitive data
- **Architecture:** Service creates new DB connection per instance instead of pooling

**Auth Response Format Issue:**
- Tests expect `{ token, user: { id, name, role } }` but implementation returns only `{ token }`
- Suggests broader authentication system inconsistency

**Performance Risks:**
- Query: `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?` without index
- No query timeout handling for long-running sorts
- Memory usage scales linearly with requested limit

**Impact:** High security and performance risk, affects production stability and data protection

## 6. Rate Limiting Infrastructure

**Problem:** No rate limiting implemented across any API endpoints.

**Why Important:**
- DoS protection: Prevents malicious users from overwhelming the system
- Resource preservation: Protects database and server resources under load
- Cost control: Limits infrastructure costs from abuse
- Fair usage: Ensures all users get reasonable access to the service

**Specific Issues:**
- No rate limiting middleware implemented anywhere in the codebase
- Activity endpoint particularly vulnerable due to potentially large datasets
- Balance calculation endpoints could be computationally expensive
- No monitoring or alerting for unusual traffic patterns

**Recommended Implementation:**
- Express-rate-limit middleware with Redis backing store
- Different limits per endpoint type (auth: 5/min, data: 100/min, activity: 10/min)
- IP-based and user-based rate limiting
- Graceful degradation with 429 status codes

**Impact:** High security risk, affects system availability and operational costs

## 7. Validation Utilities Integration

**Problem:** Centralized validation utilities (T038) created but not integrated into API endpoints - orphaned code.

**Why Important:**
- Code duplication: Each API endpoint has its own inline validation logic with inconsistent patterns
- Maintainability: Validation rules scattered across multiple files make updates error-prone
- Consistency: Different endpoints use different error messages and validation approaches for similar inputs
- Testing: Inline validation harder to test comprehensively compared to isolated utility functions
- Business rules: Validation logic not centralized means business rule changes require multiple file updates
- Quality: Comprehensive validation utilities exist with 74 tests but remain unused

**Current State:**
- `backend/src/utils/validation.ts` - Complete validation library with extensive test coverage
- `backend/tests/unit/validation.test.ts` - 74 passing tests covering all validation scenarios
- API endpoints (`auth.ts`, `users.ts`, `groups.ts`, `expenses.ts`, `balances.ts`, `activity.ts`) still use inline validation

**Specific Issues:**
- **Code Duplication:** Name validation repeated in `users.ts` and `groups.ts` with slight differences
- **Inconsistent Error Messages:** "Name is required" vs "Valid amount (positive number) is required" 
- **Missing Validation:** Some endpoints lack comprehensive validation that exists in utilities
- **Maintenance Burden:** Adding new validation rules requires updating multiple API files
- **Testing Gaps:** Inline validation not as thoroughly tested as isolated utility functions

**Required Integration:**
```javascript
// Replace inline validation like this in users.ts:
if (!name || typeof name !== 'string' || name.trim() === '') {
  return res.status(400).json({ error: 'Name is required' });
}

// With centralized validation:
import { validateUserName, formatValidationErrors } from '../utils/validation';
const nameValidation = validateUserName(name);
if (!nameValidation.isValid) {
  return res.status(400).json(formatValidationErrors(nameValidation));
}
```

**Benefits of Integration:**
- Consistent validation logic across all endpoints
- Centralized business rule management
- Better error message consistency
- Reduced code duplication (removes ~50+ lines of validation code)
- Leverages existing comprehensive test coverage
- Easier to maintain and update validation rules

**Impact:** Medium technical debt, affects code maintainability and consistency across all API endpoints

## Implementation Priorities

1. **Phase 1 (Immediate - Security First):** Input sanitization, Rate limiting infrastructure
2. **Phase 2 (Critical - Fix Integration):** Activity endpoint integration test failures
3. **Phase 3 (Performance Critical):** Resource management, Activity endpoint pagination limits
4. **Phase 4 (Architectural Improvement):** Dependency injection, Validation utilities integration
5. **Phase 5 (Code Quality):** Balance endpoints improvements, Error message standardization

## Related Issues

- Performance bottlenecks under concurrent load
- Security vulnerabilities from user inputs and DoS attacks
- Difficulty writing comprehensive unit tests
- Code duplication in service instantiation patterns and validation logic
- Scalability limitations for future growth
- Non-defensive programming patterns with potential runtime errors
- Inconsistent error logging and validation practices across endpoints
- Missing comprehensive input validation and edge case testing
- Integration test failures indicating broader system issues
- Information disclosure through verbose error messages
- Lack of database performance optimization (indexing, connection pooling)
- No monitoring or alerting for unusual API usage patterns
- Orphaned utility code not integrated into the application flow
