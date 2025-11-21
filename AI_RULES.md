# AI Rules & Guidelines

## Tech Stack Overview

- **Frontend Framework**: React with TypeScript
- **UI Library**: shadcn/ui components with Tailwind CSS for styling
- **State Management**: React Query for server state, React Context for client state
- **Routing**: React Router v6
- **Backend**: Supabase (Database, Authentication, Storage, Edge Functions)
- **Database**: PostgreSQL with Supabase
- **AI Services**: Lovable AI Gateway for LLM integrations
- **OCR Processing**: Tesseract.js for image text extraction
- **PDF Processing**: pdfjs-dist for PDF handling
- **Data Visualization**: Recharts for financial reporting

## Library Usage Rules

### UI Components
- **Primary UI Library**: Use shadcn/ui components exclusively for all UI elements
- **Styling**: Use Tailwind CSS classes for all custom styling needs
- **Icons**: Use Lucide React icons only
- **Forms**: Use React Hook Form for complex forms with Zod validation

### Data Management
- **API Calls**: Use Supabase client for all database operations
- **State Management**: Use React Query for server state, React Context for global client state
- **Caching**: Leverage React Query's built-in caching mechanisms
- **Real-time Updates**: Use Supabase real-time subscriptions when needed

### AI & External Services
- **AI Integration**: Use Lovable AI Gateway exclusively for all LLM interactions
- **OCR Processing**: Use Tesseract.js for image text extraction
- **PDF Processing**: Use pdfjs-dist for PDF text extraction
- **File Storage**: Use Supabase Storage for all file operations

### Authentication & Authorization
- **Authentication**: Use Supabase Auth with custom session management
- **Authorization**: Implement role-based access control using React Context
- **Protected Routes**: Use custom ProtectedRoute component for route protection

### Data Visualization
- **Charts**: Use Recharts library for all data visualization needs
- **Financial Reports**: Implement Recharts components for financial dashboards

### File Handling
- **CSV Processing**: Use PapaParse for CSV import/export operations
- **File Uploads**: Use Supabase Storage for all file uploads
- **File Downloads**: Implement native browser download APIs

## Component Architecture Rules

### Component Structure
- **Component Location**: Place components in appropriate directories (ui, finance, etc.)
- **Component Naming**: Use PascalCase for component names
- **Component Props**: Define prop types using TypeScript interfaces
- **Component Reusability**: Create reusable components for common UI patterns

### Page Components
- **Page Location**: Place page components in src/pages directory
- **Page Structure**: Each page should be a default export component
- **Data Fetching**: Use React Query for all data fetching in pages
- **Loading States**: Implement proper loading and error states using React Query

### Finance Module Components
- **Finance Components**: Place in src/components/finance directory
- **Financial Types**: Use types defined in src/integrations/supabase/finance-types.ts
- **Financial Operations**: Implement double-entry accounting principles
- **Currency Handling**: Format all currency values using INR formatting

## Database Rules

### Table Relationships
- **Foreign Keys**: Always use proper foreign key relationships
- **Indexing**: Add indexes for frequently queried columns
- **Constraints**: Implement proper database constraints for data integrity
- **Row Level Security**: Use Supabase RLS policies for data access control

### Query Patterns
- **Data Fetching**: Use Supabase client with proper filtering and ordering
- **Bulk Operations**: Use batch operations for multiple record insertions/updates
- **Error Handling**: Always handle Supabase errors appropriately
- **Pagination**: Implement pagination for large dataset queries

## Security Rules

### Authentication
- **Session Management**: Use secure session storage practices
- **Password Handling**: Never log or expose passwords
- **Role Verification**: Always verify user roles before rendering sensitive content
- **Route Protection**: Implement proper route protection for all sensitive pages

### Data Protection
- **Input Validation**: Validate all user inputs both client and server-side
- **SQL Injection**: Use parameterized queries to prevent SQL injection
- **XSS Prevention**: Sanitize user inputs before rendering
- **CORS**: Implement proper CORS policies for API endpoints

## Performance Rules

### Optimization
- **Bundle Size**: Minimize bundle size by using only required components
- **Lazy Loading**: Implement lazy loading for non-critical components
- **Caching**: Use React Query caching for improved performance
- **Debouncing**: Implement debouncing for search and filter operations

### Best Practices
- **Component Optimization**: Use React.memo for performance optimization
- **Effect Management**: Properly manage useEffect dependencies
- **State Management**: Minimize unnecessary re-renders
- **Network Requests**: Batch network requests when possible

## Error Handling Rules

### Client-Side Errors
- **Error Boundaries**: Implement error boundaries for graceful error handling
- **User Feedback**: Provide clear error messages to users
- **Logging**: Log errors appropriately for debugging
- **Recovery**: Implement recovery mechanisms where possible

### Server-Side Errors
- **Supabase Errors**: Handle all Supabase client errors
- **Function Errors**: Implement proper error handling in Supabase functions
- **Validation Errors**: Return appropriate error messages for validation failures
- **Graceful Degradation**: Implement fallback behaviors for failed operations

## Testing Rules

### Unit Testing
- **Test Coverage**: Aim for comprehensive test coverage for critical components
- **Mocking**: Use appropriate mocking for external dependencies
- **Test Structure**: Follow Arrange-Act-Assert pattern
- **Edge Cases**: Test edge cases and error scenarios

### Integration Testing
- **API Integration**: Test all API integrations thoroughly
- **Database Operations**: Test database operations with real data
- **Authentication Flow**: Test complete authentication flows
- **Authorization**: Test role-based access controls

## Documentation Rules

### Code Documentation
- **TypeScript Types**: Use TypeScript for all component and function typing
- **JSDoc Comments**: Add JSDoc comments for complex functions
- **Component Props**: Document all component props clearly
- **Function Descriptions**: Add descriptions for all exported functions

### User Documentation
- **Feature Descriptions**: Document all user-facing features
- **Usage Instructions**: Provide clear usage instructions
- **Troubleshooting**: Include common troubleshooting steps
- **API Documentation**: Document all custom API endpoints