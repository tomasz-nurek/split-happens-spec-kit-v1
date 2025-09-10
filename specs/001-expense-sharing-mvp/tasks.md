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
- [ ] T012 [P] Contract test for activity.yaml in backend/tests/contract/activity.test.ts
- [ ] T013 [P] Integration test for admin login flow in backend/tests/integration/admin-auth.test.ts
- [ ] T014 [P] Integration test for user management in backend/tests/integration/user-management.test.ts
- [ ] T015 [P] Integration test for group management in backend/tests/integration/group-management.test.ts
- [ ] T016 [P] Integration test for expense creation and splitting in backend/tests/integration/expense-management.test.ts
- [ ] T017 [P] Integration test for balance calculation in backend/tests/integration/balance-calculation.test.ts
- [ ] T018 [P] Integration test for activity logging in backend/tests/integration/activity-logging.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Backend Models
- [ ] T019 [P] User model in backend/src/models/User.ts
- [ ] T020 [P] Group model in backend/src/models/Group.ts
- [ ] T021 [P] GroupMembership model in backend/src/models/GroupMembership.ts
- [ ] T022 [P] Expense model in backend/src/models/Expense.ts
- [ ] T023 [P] ExpenseSplit model in backend/src/models/ExpenseSplit.ts
- [ ] T024 [P] ActivityLog model in backend/src/models/ActivityLog.ts

### Backend Services
- [ ] T025 UserService for CRUD operations in backend/src/services/UserService.ts
- [ ] T026 GroupService for CRUD operations in backend/src/services/GroupService.ts
- [ ] T027 ExpenseService for CRUD operations and split calculation in backend/src/services/ExpenseService.ts
- [ ] T028 BalanceService for balance calculation algorithms in backend/src/services/BalanceService.ts
- [ ] T029 ActivityService for logging actions in backend/src/services/ActivityService.ts
- [ ] T030 AuthService for JWT authentication in backend/src/services/AuthService.ts

### Backend API Endpoints
- [ ] T031 Auth endpoints (POST /api/auth/login, POST /api/auth/logout, GET /api/auth/verify) in backend/src/api/auth.ts
- [ ] T032 User endpoints (GET /api/users, POST /api/users, DELETE /api/users/:id) in backend/src/api/users.ts
- [ ] T033 Group endpoints (GET /api/groups, POST /api/groups, GET /api/groups/:id, POST /api/groups/:id/members, DELETE /api/groups/:id/members/:userId) in backend/src/api/groups.ts
- [ ] T034 Expense endpoints (GET /api/groups/:id/expenses, POST /api/groups/:id/expenses, DELETE /api/expenses/:id) in backend/src/api/expenses.ts
- [ ] T035 Balance endpoints (GET /api/groups/:id/balances, GET /api/users/:id/balance) in backend/src/api/balances.ts
- [ ] T036 Activity endpoint (GET /api/activity) in backend/src/api/activity.ts

### Backend Middleware and Utilities
- [ ] T037 Authentication middleware in backend/src/middleware/auth.ts
- [ ] T038 Input validation utilities in backend/src/utils/validation.ts
- [ ] T039 Error handling middleware in backend/src/middleware/error.ts
- [ ] T040 Database connection and setup in backend/src/database/index.ts

## Phase 3.4: Frontend Implementation

### Frontend Services
- [ ] T041 [P] Auth service with signals in frontend/src/services/auth.service.ts
- [ ] T042 [P] User service with signals in frontend/src/services/user.service.ts
- [ ] T043 [P] Group service with signals in frontend/src/services/group.service.ts
- [ ] T044 [P] Expense service with signals in frontend/src/services/expense.service.ts
- [ ] T045 [P] Balance service with signals in frontend/src/services/balance.service.ts
- [ ] T046 [P] Activity service with signals in frontend/src/services/activity.service.ts

### Frontend Components
- [ ] T047 Login component with signal-based form state in frontend/src/components/login/login.component.ts
- [ ] T048 User management component (list, create, delete) in frontend/src/components/users/users.component.ts
- [ ] T049 Group management component (list, create, add/remove members) in frontend/src/components/groups/groups.component.ts
- [ ] T050 Expense form component with signal-based state in frontend/src/components/expenses/expense-form.component.ts
- [ ] T051 Expense list component with computed signals in frontend/src/components/expenses/expense-list.component.ts
- [ ] T052 Balance display component with computed signals in frontend/src/components/balances/balance.component.ts
- [ ] T053 Activity log component with signal-based updates in frontend/src/components/activity/activity.component.ts
- [ ] T054 Navigation menu with computed signal for auth state in frontend/src/components/navigation/navigation.component.ts
- [ ] T055 Base layout component in frontend/src/components/layout/layout.component.ts

## Phase 3.5: Integration
- [ ] T056 Connect backend services to SQLite database
- [ ] T057 Setup CORS configuration for Angular frontend
- [ ] T058 Implement request/response logging to activity_log table
- [ ] T059 Setup routing with guards in Angular frontend
- [ ] T060 Setup HTTP interceptor for auth token in Angular frontend

## Phase 3.6: Polish
- [ ] T061 [P] Unit tests for validation rules in backend/tests/unit/validation.test.ts
- [ ] T062 [P] Unit tests for balance calculation algorithms in backend/tests/unit/balance.test.ts
- [ ] T063 Performance tests (<500ms response time)
- [ ] T064 [P] Update API documentation based on contracts
- [ ] T065 Run manual testing scenarios from quickstart.md
- [ ] T066 Remove any code duplication
- [ ] T067 Final deployment setup (Railway/Render/Heroku for backend, Netlify/Vercel for frontend)

## Dependencies
- Tests (T007-T018) before implementation (T019-T055)
- Models (T019-T024) before Services (T025-T030)
- Services (T025-T030) before API Endpoints (T031-T036)
- Backend API (T031-T036) before Frontend Services (T041-T046)
- Frontend Services (T041-T046) before Frontend Components (T047-T055)
- Implementation before polish (T061-T067)

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
