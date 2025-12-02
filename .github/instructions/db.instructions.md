---
applyTo: "packages/db/**"
---
# Database Package Guidelines (packages/db)

This document outlines the workflows and standards for managing the database schema and migrations within the `@framerate/db` package.

## 1. Role & Responsibility
- **Schema Authority**: This package is the ONLY place where database schema changes should be defined.
- **Type Provider**: It is responsible for generating and exporting TypeScript types that reflect the current database schema.
- **Migration Manager**: It handles the lifecycle of database migrations using the Supabase CLI.
- **Production Link**: This package is directly linked to the Supabase production project. We do NOT use a local Supabase instance for development to speed up the workflow.

## 2. Workflow
### 2.1 Making Schema Changes
1.  **Create Migration**: Use `bun run migration:new <description>` to create a new SQL migration file in `supabase/migrations`.
2.  **Edit SQL**: Write the SQL DDL statements in the generated file.
3.  **Apply to Production**: Run `bun run db:push` (or `supabase db push`) to apply changes directly to the remote production database.
4.  **Generate Types**: Run `bun run generate:types` to update `src/types.ts` based on the remote schema.
5.  **Commit**: Commit both the migration file and the updated types.

### 2.2 Type Generation
- **Automation**: Types must be regenerated whenever the schema changes.
- **Output**: The generated types should be located in `src/types.ts` (or similar) and exported from `src/index.ts`.
- **Usage**: Other packages (`web`, `api`, `scraper`) should import these types to ensure type safety.

## 3. Best Practices
- **SQL Standards**: Use standard SQL conventions. Keywords in UPPERCASE, identifiers in snake_case.
- **RLS Policies**: Always define Row Level Security (RLS) policies for new tables. Default to `ENABLE ROW LEVEL SECURITY`.
- **Idempotency**: Migrations should be idempotent where possible, though Supabase handles versioning.
- **No Manual Edits**: Do not manually edit `src/types.ts`. Always use the generator.
- **Direct Production**: Since we apply changes directly to production, ensure migrations are non-destructive and carefully reviewed before pushing.

## 4. Directory Structure
- `supabase/migrations/`: Contains the SQL migration files.
- `src/`: Contains the generated types and any helper utilities.
- `package.json`: Defines the scripts for database management.
