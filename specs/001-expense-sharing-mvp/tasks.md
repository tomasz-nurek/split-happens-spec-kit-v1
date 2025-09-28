# Tasks: Expense Sharing MVP

**Input**: Design documents from `/specs/001-expense-sharing-mvp/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `backend/src/`, `frontend/src/`

## Phase 3.1: Setup
- [x] T001 Create project structure per implementation plan (backend/ and frontend/ directories)
- [x] T002 Initialize Node.js backend project with Express, TypeScript, and SQLite dependencies
- [x] T003 Initialize Angular frontend project with v20 and standalone components
- [x] T004 [P] Configure linting and formatting tools (ESLint, Prettier) for both projects
- [x] T005 [P] Setup environment variables (.env) for admin credentials and JWT secret
- [x] T006 Setup database migration system for SQLite

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T007 [P] Contract test for auth.yaml in backend/tests/contract/auth.test.ts  (test added; currently failing as required)
- [x] T008 [P] Contract test for users.yaml in backend/tests/contract/users.test.ts  (test added; currently failing as required)
- [x] T009 [P] Contract test for groups.yaml in backend/tests/contract/groups.test.ts  (test added; currently failing as required)
- [x] T010 [P] Contract test for expenses.yaml in backend/tests/contract/expenses.test.ts  (test added; currently failing as required)
- [x] T011 [P] Contract test for balances.yaml in backend/tests/contract/balances.test.ts  (test added; currently failing as required)
- [x] T012 [P] Contract test for activity.yaml in backend/tests/contract/activity.test.ts  (test added; currently failing as required)
- [x] T013 [P] Integration test for admin login flow in backend/tests/integration/admin-auth.test.ts
- [x] T014 [P] Integration test for user management in backend/tests/integration/user-management.test.ts
- [x] T015 [P] Integration test for group management in backend/tests/integration/group-management.test.ts
- [x] T016 [P] Integration test for expense creation and splitting in backend/tests/integration/expense-management.test.ts
- [x] T017 [P] Integration test for balance calculation in backend/tests/integration/balance-calculation.test.ts
- [x] T018 [P] Integration test for activity logging in backend/tests/integration/activity-logging.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Backend Models
- [x] T019 [P] User model in backend/src/models/User.ts
- [x] T020 [P] Group model in backend/src/models/Group.ts
- [x] T021 [P] GroupMembership model in backend/src/models/GroupMembership.ts
- [x] T022 [P] Expense model in backend/src/models/Expense.ts
- [x] T023 [P] ExpenseSplit model in backend/src/models/ExpenseSplit.ts
- [x] T024 [P] ActivityLog model in backend/src/models/ActivityLog.ts

### Backend Services
- [x] T025 UserService for CRUD operations in backend/src/services/UserService.ts
- [x] T026 GroupService for CRUD operations in backend/src/services/GroupService.ts
- [x] T027 ExpenseService for CRUD operations and split calculation in backend/src/services/ExpenseService.ts
- [x] T028 BalanceService for balance calculation algorithms in backend/src/services/BalanceService.ts
- [x] T029 ActivityService for logging actions in backend/src/services/ActivityService.ts
- [x] T030 AuthService for JWT authentication in backend/src/services/AuthService.ts

### Backend API Endpoints
- [x] T031 Auth endpoints (POST /api/auth/login, POST /api/auth/logout, GET /api/auth/verify) in backend/src/api/auth.ts  (implemented; contract tests passing)
- [x] T032 User endpoints (GET /api/users, POST /api/users, DELETE /api/users/:id) in backend/src/api/users.ts  (implemented; contract and integration tests passing)
- [x] T033 Group endpoints (GET /api/groups, POST /api/groups, GET /api/groups/:id, POST /api/groups/:id/members, DELETE /api/groups/:id/members/:userId) in backend/src/api/groups.ts
- [x] T034 Expense endpoints (GET /api/groups/:id/expenses, POST /api/groups/:id/expenses, DELETE /api/expenses/:id) in backend/src/api/expenses.ts
- [x] T035 Balance endpoints (GET /api/groups/:id/balances, GET /api/users/:id/balance) in backend/src/api/balances.ts
- [x] T036 Activity endpoint (GET /api/activity) in backend/src/api/activity.ts  (implemented; contract tests passing)

### Backend Middleware and Utilities
- [x] T037 Authentication middleware in backend/src/middleware/auth.ts
- [x] T038 Input validation utilities in backend/src/utils/validation.ts
  - ✅ **COMPLETED**: All validation functions implement data-model.md business rules:
    - User/Group names (1-100 chars, no whitespace-only)
    - Expense amounts (positive, max 2 decimals) and descriptions (1-500 chars)
    - Split amounts (non-negative, max 2 decimals) with sum validation
    - ID validation (positive integers, arrays, no duplicates)
    - Activity log validation (CREATE/DELETE actions, entity types)
    - Helper functions for combining results and formatting API errors
- [x] T038a Refactor API endpoints to use centralized validation utilities
  - ✅ **COMPLETED**: Replaced inline validation in API endpoints with centralized utilities:
    - Updated backend/src/api/auth.ts to use validation utilities for login credentials
    - Updated backend/src/api/users.ts to use validateUserName() instead of inline checks
    - Updated backend/src/api/groups.ts to use validateGroupName() and validateIdArray()
    - Updated backend/src/api/expenses.ts to use validateAmount(), validateExpenseDescription(), validateId() for comprehensive validation
    - Updated backend/src/api/balances.ts to use validateId() for parameter validation
    - Ensured consistent error response formatting using formatValidationErrors()
    - Removed duplicated validation logic and used combineValidationResults() for multiple checks
- [x] T039 Error handling middleware in backend/src/middleware/error.ts
  - ✅ **COMPLETED**: Centralized Express error handling middleware that:
    - Catches unhandled errors from all routes using Express error handling pattern
    - Formats errors consistently as `{ error: string }` per API contracts
    - Maps error types to appropriate HTTP status codes: ValidationError(400), AuthError(401), NotFoundError(404), DatabaseError/others(500)
    - Logs errors appropriately with timestamps and request context (console.error for 500s, console.log for others)
    - Integrates with validation utilities error formatting
    - Handles common error types: ValidationError, AuthError, NotFoundError, DatabaseError, SyntaxError (JSON parsing)
    - Prevents sensitive information exposure in production environment
    - Added to Express app after all routes in src/index.ts with notFoundHandler for 404s
    - Includes asyncHandler utility for wrapping async route handlers
    - All contract tests (47/47) and unit tests (74/74) passing
- [x] T039b Security fixes for error handling middleware in backend/src/middleware/error.ts
  - ✅ COMPLETED: Hardened error handling and logging across the backend:
    - Sanitized error messages in all environments to prevent information disclosure
    - Removed user-agent logging; adopted structured JSON logs with severity levels
    - Added correlation IDs to logs and responses (x-correlation-id)
    - Updated all API routes to use custom errors (ValidationError, AuthError, NotFoundError, DatabaseError) with next(err)
    - Replaced manual try/catch with asyncHandler wrappers
    - Handled edge cases: malformed JSON (400) and payload-too-large (413)
    - Established metrics-ready logging format (severity + context)
    - Added/updated tests alongside implementation (see T039c)
- [x] T039c Unit tests for error handling middleware in backend/tests/unit/error.test.ts
  - ✅ COMPLETED: Comprehensive unit tests added for the error handling system:
    - Covered custom error classes and status mapping (400/401/404/500)
    - Verified sanitized messages in all environments
    - Tested 404 notFoundHandler and asyncHandler behavior
    - Exercised JSON parse errors (400) and payload-too-large (413)
    - Ensured unknown errors are sanitized and logged with ERROR severity
    - Asserted structured logging shape (no user-agent, with correlationId)
    - High coverage for middleware and utilities
- [ ] T040 Database connection and setup in backend/src/database/index.ts
  - **REQUIREMENT**: Enhanced database initialization and connection management:
    - Initialize knex instance with proper environment configuration (dev/test/production)
    - Add automatic migration runner on application startup using `knex.migrate.latest()`
    - Implement database health check function to verify connectivity
    - Add graceful error handling for database connection failures
    - Export configured db instance for use across backend services
    - Add database connection logging for debugging
    - Ensure migrations run before any API endpoints are available
    - Handle database file creation for SQLite if it doesn't exist

## Phase 3.4: Frontend Implementation

### Frontend Project Setup (Prerequisites for services)
- [ ] T041 Setup Angular project structure and core configuration in frontend/src/
  - **REQUIREMENT**: Establish proper Angular v20 project foundation:
    - Create directory structure: `services/`, `components/`, `guards/`, `interceptors/`, `types/`
    - Configure HttpClient in app.config.ts with `provideHttpClient()`
    - Setup base API service in `frontend/src/services/api.service.ts` with environment-based URL configuration
    - Create error handling service in `frontend/src/services/error.service.ts` for centralized error management
    - Setup TypeScript interfaces in `frontend/src/types/` for API response types (User, Group, Expense, etc.)
    - Configure basic routing in app.routes.ts with placeholder routes
    - Add Angular Material or basic CSS framework for consistent UI components
    - Ensure standalone components architecture is properly configured

### Frontend Services  
- [ ] T041b [P] Auth service with signals in frontend/src/services/auth.service.ts
### Frontend Services  
- [ ] T041b [P] Auth service with signals in frontend/src/services/auth.service.ts
  - **REQUIREMENT**: JWT-based authentication service using Angular signals:
    - Implement signal-based state management for authentication status
    - Login/logout methods that communicate with backend auth API
    - Token storage in localStorage with automatic refresh
    - Auth state computed signals for reactive UI updates
    - Integration with auth guard for route protection
- [ ] T042 [P] User service with signals in frontend/src/services/user.service.ts
- [ ] T043 [P] Group service with signals in frontend/src/services/group.service.ts
- [ ] T044 [P] Expense service with signals in frontend/src/services/expense.service.ts
- [ ] T045 [P] Balance service with signals in frontend/src/services/balance.service.ts
- [ ] T046 [P] Activity service with signals in frontend/src/services/activity.service.ts

### Frontend Guards and Interceptors
- [ ] T047 Auth guard and HTTP interceptor setup in frontend/src/guards/ and frontend/src/interceptors/
  - **REQUIREMENT**: Authentication and HTTP handling infrastructure:
    - Create auth guard in `frontend/src/guards/auth.guard.ts` that checks authentication state
    - Implement HTTP interceptor in `frontend/src/interceptors/auth.interceptor.ts` for automatic token injection
    - Create error interceptor in `frontend/src/interceptors/error.interceptor.ts` for global error handling
    - Configure guards and interceptors in app.config.ts
    - Setup route protection for all authenticated routes

### Frontend Components
- [ ] T048 Login component with signal-based form state in frontend/src/components/login/login.component.ts
- [ ] T049 User management component (list, create, delete) in frontend/src/components/users/users.component.ts
- [ ] T050 Group management component (list, create, add/remove members) in frontend/src/components/groups/groups.component.ts
- [ ] T051 Expense form component with signal-based state in frontend/src/components/expenses/expense-form.component.ts
- [ ] T052 Expense list component with computed signals in frontend/src/components/expenses/expense-list.component.ts
- [ ] T053 Balance display component with computed signals in frontend/src/components/balances/balance.component.ts
- [ ] T054 Activity log component with signal-based updates in frontend/src/components/activity/activity.component.ts
- [ ] T055 Navigation menu with computed signal for auth state in frontend/src/components/navigation/navigation.component.ts
- [ ] T056 Base layout component in frontend/src/components/layout/layout.component.ts

## Phase 3.5: Integration
- [ ] T057 Connect backend services to SQLite database
- [ ] T058 Setup CORS configuration for Angular frontend
- [ ] T059 Implement request/response logging to activity_log table
- [ ] T060 Setup routing with guards in Angular frontend
- [ ] T061 Setup HTTP interceptor for auth token in Angular frontend
- [ ] T068 Align integration tests to exported app and env (use `app` from `backend/src/index.ts`; set `ADMIN_PASSWORD=admin123` in `backend/.env`) for files: `backend/tests/integration/admin-auth.test.ts`, `backend/tests/integration/group-management.test.ts`, `backend/tests/integration/expense-management.test.ts`, `backend/tests/integration/balance-calculation.test.ts`, `backend/tests/integration/activity-logging.test.ts`

## Phase 3.6: Polish
- [ ] T062 [P] Unit tests for validation rules in backend/tests/unit/validation.test.ts
- [ ] T063 [P] Unit tests for balance calculation algorithms in backend/tests/unit/balance.test.ts
- [ ] T064 Performance tests (<500ms response time)
- [ ] T065 [P] Update API documentation based on contracts
- [ ] T066 Run manual testing scenarios from quickstart.md
- [ ] T067 Remove any code duplication
- [ ] T068 Final deployment setup (Railway/Render/Heroku for backend, Netlify/Vercel for frontend)

## Dependencies
- Tests (T007-T018) before implementation (T019-T056)
- Models (T019-T024) before Services (T025-T030)
- Services (T025-T030) before API Endpoints (T031-T036)
- Backend API (T031-T036) before Frontend Setup (T041)
- Frontend Setup (T041) before Frontend Services (T041b-T046)
- Frontend Services (T041b-T046) before Frontend Guards/Interceptors (T047)
- Frontend Guards/Interceptors (T047) before Frontend Components (T048-T056)
- Implementation before polish (T062-T068)

## Parallel Example
```
# Launch T007-T012 together (contract tests):
Task: "Contract test for auth.yaml in backend/tests/contract/auth.test.ts"
Task: "Contract test for users.yaml in backend/tests/contract/users.test.ts"
Task: "Contract test for groups.yaml in backend/tests/contract/groups.test.ts"
Task: "Contract test for expenses.yaml in backend/tests/contract/expenses.test.ts"
Task: "Contract test for balances.yaml in backend/tests/contract/balances.test.ts"
Task: "Contract test for activity.yaml in backend/tests/contract/activity.test.ts"

# Launch T019-T024 together (models):
Task: "User model in backend/src/models/User.ts"
Task: "Group model in backend/src/models/Group.ts"
Task: "GroupMembership model in backend/src/models/GroupMembership.ts"
Task: "Expense model in backend/src/models/Expense.ts"
Task: "ExpenseSplit model in backend/src/models/ExpenseSplit.ts"
Task: "ActivityLog model in backend/src/models/ActivityLog.ts"

# Launch T041b-T046 together (frontend services after T041 setup):
Task: "Auth service with signals in frontend/src/services/auth.service.ts"
Task: "User service with signals in frontend/src/services/user.service.ts"
Task: "Group service with signals in frontend/src/services/group.service.ts"
Task: "Expense service with signals in frontend/src/services/expense.service.ts"
Task: "Balance service with signals in frontend/src/services/balance.service.ts"
Task: "Activity service with signals in frontend/src/services/activity.service.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file → contract test task [P]
   - Each endpoint → implementation task
   
2. **From Data Model**:
   - Each entity → model creation task [P]
   - Relationships → service layer tasks
   
3. **From User Stories**:
   - Each story → integration test [P]
   - Quickstart scenarios → validation tasks

4. **Ordering**:
   - Setup → Tests → Models → Services → Endpoints → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests
- [x] All entities have model tasks
- [x] All tests come before implementation
- [x] Parallel tasks truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
