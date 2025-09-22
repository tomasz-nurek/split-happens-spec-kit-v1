# Implementation Plan: Expense Sharing MVP

**Branch**: `001-expense-sharing-mvp` | **Date**: 2025-09-10 | **Spec**: [link](/specs/001-expense-sharing-mvp/spec.md)
**Input**: Feature specification from `/specs/001-expense-sharing-mvp/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
A simple expense-sharing application for personal use, where a single admin manages all users, groups, and expenses. The application includes admin authentication, user and group management, expense tracking with equal splitting, balance calculations, and activity logging. The technical approach involves a Node.js + Express backend with TypeScript and SQLite, and an Angular v20 frontend using standalone components and signals for state management.

## Technical Context
**Language/Version**: Node.js with TypeScript, Angular v20  
**Primary Dependencies**: Express.js, better-sqlite3, JWT for authentication, Angular Signals  
**Storage**: SQLite3 database  
**Testing**: Backend tests with Vitest, Frontend tests with Jasmine/Karma.  
**Target Platform**: Web application (responsive for mobile browsers)  
**Project Type**: web (frontend + backend)  
**Performance Goals**: Response time < 500ms for all API calls  
**Constraints**: Single admin session at a time, SQLite database file < 100MB  
**Scale/Scope**: Support up to 100 users, 50 groups, 1000 expenses

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: [2] (backend, frontend)
- Using framework directly? (no wrapper classes) YES
- Single data model? (no DTOs unless serialization differs) YES
- Avoiding patterns? (no Repository/UoW without proven need) YES

**Architecture**:
- EVERY feature as library? (no direct app code) NO - Direct application code for MVP
- Libraries listed: [N/A for MVP]
- CLI per library: [N/A for MVP]
- Library docs: llms.txt format planned? NO

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? (test MUST fail first) YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? (actual DBs, not mocks) YES
- Integration tests for: new libraries, contract changes, shared schemas? YES

**Observability**:
- Structured logging included? YES - Activity log table
- Frontend logs → backend? (unified stream) NO
- Error context sufficient? YES

**Versioning**:
- Version number assigned? (MAJOR.MINOR.BUILD) NO - Not specified for MVP
- BUILD increments on every change? NO - Not specified for MVP
- Breaking changes handled? (parallel tests, migration plan) NO - Not applicable for MVP

## Project Structure

### Documentation (this feature)
```
specs/001-expense-sharing-mvp/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── services/
│   ├── guards/
│   ├── interceptors/
│   └── types/
└── tests/
```

**Structure Decision**: Option 2 - Web application with separate backend and frontend directories

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh [claude|gemini|copilot]` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Direct application code instead of libraries | MVP scope requires rapid development | Creating libraries would add unnecessary complexity for a simple MVP |
|-----------|------------|-------------------------------------|

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*