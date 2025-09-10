# Feature: Expense Sharing MVP

## Description
A simple expense-sharing application for personal use, where a single admin manages all users, groups, and expenses. Think of it as a private, simplified Splitwise where only the admin can input data - perfect for managing shared expenses among friends and family.

## Requirements
1. Admin Authentication
   - Single hardcoded admin user (credentials in .env file)
   - Basic session/JWT authentication
   - No user registration or multi-user login

2. User Management (Admin Only)
   - Create user profiles (just name, no email/password)
   - View all users list
   - Delete users
   - Users are just data entities, not accounts

3. Group Management (Admin Only)
   - Create groups with a name
   - Add/remove users to/from groups
   - View all groups
   - View group members

4. Expense Management
   - Add expense with:
     - Amount
     - Description
     - Who paid (single payer)
     - Who participates (multiple people)
     - Date (auto-set to now)
   - Equal split only - amount divided equally among participants
   - View expenses within a group
   - Delete expenses (no editing - delete and re-add if needed)

5. Balance Calculation
   - Show who owes whom within each group
   - Simple debt summary per person
   - Overall balance view across all groups

6. Activity Log
   - Track who (admin) added which expense and when
   - Track deletions with timestamp
   - Simple chronological history view

## Implementation Plan
Phase 1: Backend Foundation (Day 1)
- Initialize Express + TypeScript project
- Setup SQLite database and schema
- Create admin authentication middleware
- Setup CORS for Angular
- Create base error handling

Phase 2: Backend CRUD APIs (Day 1-2)
- Implement user management endpoints
- Implement group management endpoints
- Add activity logging utility
- Add input validation

Phase 3: Angular Setup with Signals (Day 2)
- Initialize Angular v20 project with standalone components
- Setup routing with guards
- Create auth service with signals for auth state
- Setup HTTP interceptor for auth token
- Create signal-based state services
- Create base layout component

Phase 4: Angular Features with Signals (Day 2-3)
- Login component with signal-based form state
- Users management with signals (list, create, delete)
- Groups management with signals
- Navigation menu with computed signal for auth state

Phase 5: Expense Features (Day 3)
- Backend expense endpoints with split calculation
- Angular expense form with signal-based state
- Expense list with computed signals
- Integration testing

Phase 6: Balances with Computed Signals (Day 3-4)
- Backend balance calculation algorithm
- Angular balance view with computed signals
- Balance summary cards with derived state

Phase 7: Activity Log (Day 4)
- Complete activity logging on backend
- Activity feed with signal-based updates
- Final testing and deployment

## API Changes
Authentication
- POST /api/auth/login - Admin login
- POST /api/auth/logout - Admin logout
- GET /api/auth/verify - Verify token

Users
- GET /api/users - List all users
- POST /api/users - Create user
- DELETE /api/users/:id - Delete user

Groups
- GET /api/groups - List all groups
- POST /api/groups - Create group
- GET /api/groups/:id - Get group with members
- POST /api/groups/:id/members - Add members to group
- DELETE /api/groups/:id/members/:userId - Remove member from group

Expenses
- GET /api/groups/:id/expenses - List group expenses
- POST /api/groups/:id/expenses - Create expense
- DELETE /api/expenses/:id - Delete expense

Balances
- GET /api/groups/:id/balances - Get group balances
- GET /api/users/:id/balance - Get user's overall balance

Activity
- GET /api/activity - Get activity log

## Database Changes
Tables to be created:
- Users (not auth users, just people in expenses)
- Groups
- Group membership
- Expenses
- Who participates in each expense
- Activity log

Schema:
-- Users (not auth users, just people in expenses)
CREATE TABLE users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Groups
CREATE TABLE groups (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Group membership
CREATE TABLE group_members (
 group_id INTEGER,
 user_id INTEGER,
 FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY (group_id, user_id)
);

-- Expenses
CREATE TABLE expenses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 group_id INTEGER NOT NULL,
 amount DECIMAL(10,2) NOT NULL,
 description TEXT NOT NULL,
 paid_by INTEGER NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
 FOREIGN KEY (paid_by) REFERENCES users(id)
);

-- Who participates in each expense
CREATE TABLE expense_splits (
 expense_id INTEGER,
 user_id INTEGER,
 amount DECIMAL(10,2) NOT NULL,
 FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id),
 PRIMARY KEY (expense_id, user_id)
);

-- Activity log
CREATE TABLE activity_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 action TEXT NOT NULL, -- 'CREATE', 'DELETE'
 entity_type TEXT NOT NULL, -- 'expense', 'user', 'group'
 entity_id INTEGER,
 details TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

## UI/UX Changes
Angular Signal Architecture:
- State Management Structure with signal-based services
- Component Structure using standalone components with signals
- New Control Flow (@if, @for, @switch)
- Signal-based forms for all input
- Computed signals for derived state (balances)
- Effect for side effects when needed

UI Components:
- Login form
- User management (list, create, delete)
- Group management (list, create, add/remove members)
- Expense form (amount, description, payer, participants)
- Expense list view
- Balance display per group and overall
- Activity log view

## Testing Considerations
- Backend: Unit and integration tests using Vitest.
- Frontend: Unit tests using Jasmine and Karma.
- Test all CRUD operations for users, groups, and expenses.
- Verify balance calculations are accurate.
- Test authentication flow.
- Verify activity logging works correctly.
- Test edge cases like deleting users/groups with associated data.
- Mobile responsiveness testing.

## Success Criteria
- Deployed and accessible via public URL
- Can create users and groups
- Can add expenses with automatic equal splits
- Accurate balance calculations
- Activity history is tracked
- Used for at least one real expense scenario
- Total development time < 4 days
- Backend < 1000 lines of code
- Clean signal-based state management
- Works on mobile browsers
