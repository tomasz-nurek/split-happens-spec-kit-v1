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

## Implementation Priorities

1. **Phase 1 (Immediate - Security First):** Input sanitization
2. **Phase 2 (Performance Critical):** Resource management
3. **Phase 3 (Architectural Improvement):** Dependency injection
4. **Phase 4 (Code Quality):** Balance endpoints improvements

## Related Issues

- Performance bottlenecks under concurrent load
- Security vulnerabilities from user inputs
- Difficulty writing comprehensive unit tests
- Code duplication in service instantiation patterns
- Scalability limitations for future growth
- Non-defensive programming patterns with potential runtime errors
- Inconsistent error logging practices across endpoints
- Missing comprehensive input validation and edge case testing
