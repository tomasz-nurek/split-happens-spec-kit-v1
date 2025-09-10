# Quick Start Guide: Expense Sharing MVP

## Prerequisites

1. Node.js v18+ installed
2. npm or yarn package manager
3. SQLite3 installed
4. Angular CLI v20+ installed

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with admin credentials:
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password_here
   JWT_SECRET=your_jwt_secret_here
   ```

4. Initialize the database:
   ```bash
   npm run migrate
   ```

5. Start the backend server:
   ```bash
   npm run start
   ```

The backend API will be available at `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run start
   ```

The frontend application will be available at `http://localhost:4200`

## Quick Validation Steps

### 1. Admin Login
1. Open the frontend application in your browser
2. Enter admin credentials (from your `.env` file)
3. Verify successful login and redirect to dashboard

### 2. Create Users
1. Navigate to the Users section
2. Create at least 3 test users (e.g., Alice, Bob, Charlie)
3. Verify users appear in the users list

### 3. Create Group
1. Navigate to the Groups section
2. Create a new group (e.g., "Weekend Trip")
3. Verify the group appears in the groups list

### 4. Add Users to Group
1. Open the group details
2. Add the test users to the group
3. Verify all users appear in the group members list

### 5. Add Expense
1. Navigate to the group's expense section
2. Create a new expense:
   - Amount: $60.00
   - Description: "Dinner"
   - Paid by: Alice
   - Participants: Alice, Bob, Charlie
3. Verify the expense appears in the list

### 6. Check Balances
1. Navigate to the group's balance section
2. Verify balances are calculated correctly:
   - Alice: +$40.00 (paid $60, owes $20, net +$40)
   - Bob: -$20.00 (paid $0, owes $20, net -$20)
   - Charlie: -$20.00 (paid $0, owes $20, net -$20)

### 7. Check Activity Log
1. Navigate to the Activity section
2. Verify the following entries exist:
   - User creation events
   - Group creation event
   - Group membership events
   - Expense creation event

### 8. Delete Expense
1. Delete the previously created expense
2. Verify the expense is removed from the list
3. Verify balances return to zero
4. Verify a deletion entry appears in the activity log

## API Endpoints Quick Reference

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/verify` - Verify token

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `DELETE /api/users/:id` - Delete user

### Groups
- `GET /api/groups` - List all groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/members` - Add members to group
- `DELETE /api/groups/:id/members/:userId` - Remove member from group

### Expenses
- `GET /api/groups/:id/expenses` - List group expenses
- `POST /api/groups/:id/expenses` - Create expense
- `DELETE /api/expenses/:id` - Delete expense

### Balances
- `GET /api/groups/:id/balances` - Get group balances
- `GET /api/users/:id/balance` - Get user's overall balance

### Activity
- `GET /api/activity` - Get activity log

## Common Issues and Solutions

### Database Connection Issues
- Ensure SQLite3 is properly installed
- Check that the database file has correct permissions
- Verify the database path in configuration

### Authentication Failures
- Verify `.env` file contains correct credentials
- Check that JWT_SECRET is set
- Ensure the backend server is running

### CORS Errors
- Verify CORS is properly configured in backend
- Check that frontend and backend URLs match configuration

### Performance Issues
- Ensure database indexes are created
- Check that pagination is implemented for large lists
- Verify that queries are optimized

## Next Steps

1. Deploy the backend to Railway/Render/Heroku
2. Deploy the frontend to Netlify/Vercel
3. Configure custom domains
4. Test the deployed application with real expense scenarios
5. Verify mobile responsiveness
6. Document any issues encountered during deployment
