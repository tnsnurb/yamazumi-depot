---
name: Yamazumi API Factory
description: Ensuring consistency and security in the Yamazumi Depot API layer (Route-Controller-Service pattern).
---

# Yamazumi API Factory Skill

This skill ensures that all new API features follow the project's established modular architecture and security standards.

## 1. Architectural Pattern
Always follow the **Route -> Controller -> Service/RPC** hierarchy:
- **Routes (`src/routes/`)**: Purely definition. No business logic.
- **Controllers (`src/controllers/`)**: Request handling, validation, response formatting.
- **Services (`src/services/`)**: Heavy lifting, reusable business logic, complex data transformations.
- **RPC (Supabase)**: Use for atomic multi-table operations (e.g., `move_locomotive`).

## 2. Authentication & Authorization (Flat Middleware)
All protected routes MUST use explicit middleware chaining from `src/middlewares/auth`:
- `requireAuth` MUST be the first middleware for any protected route.
- `requireAdmin` or `requirePermission('key')` MUST follow `requireAuth`.
- **Example**: `router.post('/path', requireAuth, requirePermission('can_edit'), controller.method);`

## 3. Data Integrity & Security
- **CSV Exports**: Always use `exceljs` to generate files to prevent CSV Injection. Use `movementController.js` as a template.
- **Database**: Use the centralized `supabase` client from `../../db` or appropriate relative path.
- **DRY**: If you're identifying a locomotive, use `resolveLocoId` from `src/services/locomotiveService.js`.

## 4. Response Format
- Consistent JSON responses: `{ message: "Success" }` or `{ error: "Error details" }`.
- Use appropriate HTTP status codes: 200/201 for success, 400 for validation, 401 for auth, 403 for forbidden, 500 for server errors.
