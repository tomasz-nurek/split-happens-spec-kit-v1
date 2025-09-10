# Data Model: Expense Sharing MVP

## Entities

### User
Represents a person who participates in expense sharing groups.

**Fields**:
- id: INTEGER (Primary Key, Auto-increment)
- name: TEXT (Required)
- created_at: DATETIME (Default: CURRENT_TIMESTAMP)

**Validation Rules**:
- Name must be between 1 and 100 characters
- Name cannot be empty or whitespace only

**Relationships**:
- Has many GroupMemberships (CASCADE DELETE)
- Has many ExpenseSplits (CASCADE DELETE)
- Has many Expenses as payer (CASCADE DELETE)

### Group
Represents a collection of users who share expenses.

**Fields**:
- id: INTEGER (Primary Key, Auto-increment)
- name: TEXT (Required)
- created_at: DATETIME (Default: CURRENT_TIMESTAMP)

**Validation Rules**:
- Name must be between 1 and 100 characters
- Name cannot be empty or whitespace only

**Relationships**:
- Has many GroupMemberships (CASCADE DELETE)
- Has many Expenses (CASCADE DELETE)

### GroupMembership
Junction table representing which users belong to which groups.

**Fields**:
- group_id: INTEGER (Foreign Key to Group, CASCADE DELETE)
- user_id: INTEGER (Foreign Key to User, CASCADE DELETE)

**Composite Primary Key**: (group_id, user_id)

**Validation Rules**:
- A user cannot be added to the same group twice
- Both group_id and user_id must reference existing records

**Relationships**:
- Belongs to Group
- Belongs to User

### Expense
Represents a single expense within a group.

**Fields**:
- id: INTEGER (Primary Key, Auto-increment)
- group_id: INTEGER (Foreign Key to Group, CASCADE DELETE)
- amount: DECIMAL(10,2) (Required)
- description: TEXT (Required)
- paid_by: INTEGER (Foreign Key to User)
- created_at: DATETIME (Default: CURRENT_TIMESTAMP)

**Validation Rules**:
- Amount must be positive
- Amount must have at most 2 decimal places
- Description must be between 1 and 500 characters
- paid_by must reference an existing user
- group_id must reference an existing group
- paid_by user must be a member of the group

**Relationships**:
- Belongs to Group
- Belongs to User (payer)
- Has many ExpenseSplits (CASCADE DELETE)

### ExpenseSplit
Junction table representing how an expense is divided among participants.

**Fields**:
- expense_id: INTEGER (Foreign Key to Expense, CASCADE DELETE)
- user_id: INTEGER (Foreign Key to User, CASCADE DELETE)
- amount: DECIMAL(10,2) (Required)

**Composite Primary Key**: (expense_id, user_id)

**Validation Rules**:
- Amount must be positive or zero
- Amount must have at most 2 decimal places
- The sum of all splits for an expense should equal the expense amount
- User must be a member of the expense's group

**Relationships**:
- Belongs to Expense
- Belongs to User

### ActivityLog
Tracks all admin actions for audit purposes.

**Fields**:
- id: INTEGER (Primary Key, Auto-increment)
- action: TEXT (Required) - 'CREATE', 'DELETE'
- entity_type: TEXT (Required) - 'expense', 'user', 'group'
- entity_id: INTEGER (Optional)
- details: TEXT (Optional)
- created_at: DATETIME (Default: CURRENT_TIMESTAMP)

**Validation Rules**:
- Action must be one of the defined values
- Entity_type must be one of the defined values
- Details field should contain relevant context information

**Relationships**:
- None (standalone audit log)

## Entity Relationships Diagram

```
User 1-----< GroupMembership >-----1 Group
  |                                    |
  |                                    |
  1                                    1
  |                                    |
  |                                    |
ExpenseSplit >-----1 Expense >---------^
  |                                    |
  1                                    |
  |                                    |
  ^------------------------------------^
```

## Database Schema

```sql
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
```

## Indexes

```sql
-- Improve query performance for foreign key lookups
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_expenses_group_id ON expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON expense_splits(user_id);
CREATE INDEX idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
```

## State Transitions

### User States
Users in this system are simple data entities with no state transitions. They are either present in the system or deleted.

### Group States
Groups in this system are simple data entities with no state transitions. They are either present in the system or deleted.

### Expense States
Expenses in this system are simple data entities with no state transitions. They are either present in the system or deleted.

## Business Rules

1. **Group Membership**: A user must be a member of a group to be included in an expense within that group
2. **Expense Splitting**: All participants in an expense must be members of the group the expense belongs to
3. **Balance Calculation**: A user's balance in a group is the sum of amounts they've paid minus the sum of amounts they owe from expense splits
4. **Data Integrity**: All foreign key relationships are enforced with CASCADE DELETE to maintain consistency
5. **Activity Logging**: All CREATE and DELETE operations on core entities are logged for audit purposes

## Derived Data

### Balance Calculation
Balances are derived from the expense data using the following algorithm:

For each user in a group:
1. Sum of amounts paid by the user in that group
2. Sum of amounts owed by the user in that group (from expense_splits)
3. Balance = Amounts Paid - Amounts Owed

Overall balance for a user:
1. Sum of all balances across all groups

### Debt Relationships
Debt relationships are derived from the balance calculations:
1. If User A has a positive balance and User B has a negative balance in the same group
2. User B owes User A the absolute value of User B's balance (up to the limit of User A's positive balance)
