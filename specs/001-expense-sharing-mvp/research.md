# Research Findings: Expense Sharing MVP

## Technical Context Clarifications

All technical context items have been resolved based on the feature specification:

1. **Language/Version**: Node.js with TypeScript for backend, Angular v20 for frontend
2. **Primary Dependencies**: Express.js, better-sqlite3, JWT for authentication, Angular Signals
3. **Storage**: SQLite3 database
4. **Testing**: Manual testing only as specified in requirements
5. **Target Platform**: Web application with mobile responsiveness
6. **Performance Goals**: Response time < 500ms for all API calls
7. **Constraints**: Single admin session, SQLite database file < 100MB
8. **Scale/Scope**: Support up to 100 users, 50 groups, 1000 expenses

## Technology Research

### Node.js + Express Backend
**Decision**: Use Node.js with Express for the backend API
**Rationale**: 
- Lightweight and fast for MVP
- Large ecosystem of packages
- Familiarity with JavaScript/TypeScript team
- Good performance for the specified scale

**Alternatives considered**:
- Python/FastAPI: Good performance but less familiar for team
- Java/Spring Boot: More robust but overkill for MVP
- Go: High performance but steeper learning curve

### SQLite Database
**Decision**: Use SQLite for data storage
**Rationale**:
- Simple setup with no separate database server needed
- Sufficient for the specified scale (100 users, 50 groups, 1000 expenses)
- Easy deployment as a single file
- Well-supported by better-sqlite3 package

**Alternatives considered**:
- PostgreSQL: More robust but unnecessary complexity for MVP
- MySQL: Similar to PostgreSQL but SQLite simpler for MVP
- MongoDB: Document database not needed for this structured data

### Angular v20 Frontend
**Decision**: Use Angular v20 with standalone components and signals
**Rationale**:
- Modern Angular with improved performance
- Standalone components reduce boilerplate
- Signals provide reactive state management without RxJS complexity
- Familiarity with framework team

**Alternatives considered**:
- React: Popular but team more familiar with Angular
- Vue.js: Simpler but team familiarity with Angular
- Svelte: Compile-time optimization but less familiar to team

### JWT Authentication
**Decision**: Use JWT for admin authentication
**Rationale**:
- Standard approach for stateless authentication
- Well-supported in Node.js ecosystem
- Simple to implement for single admin user
- No need for complex OAuth for MVP

**Alternatives considered**:
- Session-based authentication: Requires server-side storage
- OAuth: Overly complex for single admin user
- API keys: Less secure and user-friendly than JWT

## Best Practices Research

### Backend Structure
**Decision**: Follow standard Express.js project structure
**Rationale**:
- Clear separation of concerns (routes, controllers, services, models)
- Easy to understand and maintain
- Follows common Node.js patterns

### Angular Architecture
**Decision**: Use signal-based state management with standalone components
**Rationale**:
- Aligns with Angular v20 best practices
- Reduces complexity compared to traditional RxJS patterns
- Better performance with fine-grained change detection
- Computed signals for derived state (balances)

### Database Design
**Decision**: Use normalized relational schema with foreign key constraints
**Rationale**:
- Data integrity through foreign key relationships
- Efficient querying for expense calculations
- ACID compliance for transactional consistency
- CASCADE deletes to maintain data consistency

## Implementation Patterns

### Expense Splitting Algorithm
**Decision**: Calculate equal splits at time of expense creation
**Rationale**:
- Simple and meets MVP requirements
- Store calculated amounts in expense_splits table
- Avoids complex calculations during balance display
- Easy to verify correctness

### Balance Calculation
**Decision**: Calculate balances dynamically from expense data
**Rationale**:
- Always accurate based on current data
- No need to maintain separate balance table
- Simple algorithm: sum of amounts paid minus share of expenses
- Efficient with proper indexing

## Deployment Research

### Backend Deployment
**Decision**: Deploy to Railway/Render/Heroku
**Rationale**:
- Free tier options available
- Simple deployment process
- Good for MVP with limited budget
- Handles scaling automatically

### Frontend Deployment
**Decision**: Deploy to Netlify/Vercel
**Rationale**:
- Excellent support for modern frontend frameworks
- Free tier sufficient for MVP
- Global CDN for performance
- Easy custom domain setup

## Security Considerations

### Admin Authentication
**Decision**: Single hardcoded admin user with JWT
**Rationale**:
- Meets MVP requirements exactly
- Simple implementation for solo developer
- Secure enough for personal/family use case
- No need for complex user management

### Data Protection
**Decision**: Basic input validation and sanitization
**Rationale**:
- Prevent common injection attacks
- Validate data types and ranges
- Sufficient for MVP scope
- No PII data to protect beyond names

## Performance Optimization

### Database Indexing
**Decision**: Add indexes on foreign key columns
**Rationale**:
- Improve query performance for joins
- Essential for balance calculations
- Minimal storage overhead
- Standard best practice

### API Response Optimization
**Decision**: Implement pagination for list endpoints
**Rationale**:
- Prevent large response payloads
- Better user experience with loading
- Future-proof for scaling beyond MVP
- Standard REST API practice

## Summary

All technical context items have been clarified and research completed. The chosen technologies align well with the MVP requirements and constraints. The implementation approach balances simplicity with good practices, ensuring the project can be completed within the 4-day timeline while maintaining code quality.
