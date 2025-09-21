import express from 'express';
import cors from 'cors';
import { authRouter } from './api/auth';
import { usersRouter } from './api/users';
import { groupsRouter } from './api/groups';
import { expensesRouter } from './api/expenses';
import { balancesRouter } from './api/balances';
import { activityRouter } from './api/activity';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', expensesRouter);
app.use('/api', balancesRouter);
app.use('/api', activityRouter);

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// Export app for testing
export { app };

// Only start server if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
