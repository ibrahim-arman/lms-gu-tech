# GUTECH Learning Studio

A responsive learning management system built with React, TypeScript, Vite, Express, and Supabase. The application uses the `Frontend` and `Backend` workspaces, with database migrations under `Backend/supabase/migrations`.

## What is included

- Responsive role-aware application shell for students, teachers, and admins, including a learner dashboard and profile screen.
- Supabase email/password sign-in, session persistence, role redirects, protected routes, forgot-password email, and password reset.
- Admin people directory with role filtering, search, account creation, account updates, and soft deactivation.
- Password recovery with an expired-link state, password strength feedback, confirmation, and current-password verification for profile password changes.
- Express API health check, authenticated profile and course reads, profile name updates, and admin user list/create/update/deactivate endpoints.
- Zod request validation, standard API error responses, role middleware, Helmet, strict CORS, rate limiting, and redacted request logs.
- Initial Supabase schema for the LMS entities, indexes, auth profile trigger, RLS policies, helper functions, and private storage buckets.
- `.env.example` files for client and server. Copy these to `.env` in their respective folders and supply your project values. Real credentials are not committed.

The remaining feature areas are represented in the schema and navigation, but their end-to-end workflows (course administration, uploads, assignment submissions, quizzes, gradebook, announcements, chat, complaint handling, seed data, and their associated API screens) still need implementation. Those features should be completed in the phase order in the supplied specification before production use.

## Requirements

- Node.js 20 or newer
- A Supabase project with email/password authentication enabled

## Run locally

1. Copy `Frontend/.env.example` to `Frontend/.env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`.
2. Copy `Backend/.env.example` to `Backend/.env` and set `SUPABASE_URL`, `secret_api_key_supabase`, `SUPABASE_JWT_SECRET`, and `CLIENT_URL`. The backend accepts `secret_api_key_supabase` as its server-only Supabase secret key. Never put it in a `VITE_` variable.
3. Apply `Backend/supabase/migrations/001_initial_schema.sql` to the Supabase project using the Supabase SQL editor or CLI.
4. From the repository root, run `npm install`, then `npm run dev`.
5. Open `http://localhost:5173`; the API listens on `http://localhost:4000` by default. `GET /api/health` returns the API status.

## Supabase setup

- Enable email/password under Authentication providers. Public signup is not part of the product; the admin API creates accounts.
- Configure the password recovery email template and add `http://localhost:5173/reset-password` and your deployed frontend reset URL to the Auth redirect URL allow-list.
- The migration creates the private buckets `resources`, `assignment-files`, `submissions`, `complaint-attachments`, and `avatars`. File workflows should issue short-lived signed URLs from the API.
- The first admin account can be created in Supabase Auth; the auth trigger creates its student profile. Promote that profile to `admin` using the Supabase SQL editor before using admin-only account management.
- The service-role key bypasses RLS. Keep it only in the backend and apply authorization checks in each API route in addition to database RLS.

## Architecture and conventions

- The browser uses Supabase only for Auth and (when implemented) Realtime and direct signed file transfers. Business data is accessed through the Express API.
- The API verifies the Supabase bearer token and loads the active profile and role on each authenticated request.
- Database columns use `snake_case`; API payloads currently mirror the profile and course table fields. Errors use `{ "error": { "code", "message", "details?" } }`.
- Environment is parsed with Zod at backend startup; invalid or missing server configuration prevents startup.
- No seeded development credentials exist yet. Create accounts through an admin workflow after promoting the first admin profile.

## Assumptions

- One teacher owns each course, as specified for v1.
- The current learner dashboard uses example schedule and course presentation data until the course feature UI and its API are completed.
- Profile email and role are institution-managed. The profile page permits a validated display-name change and password update after current-password verification.
- The LMS is single-institution and has no public signup, payments, video conferencing, or general email notifications.
