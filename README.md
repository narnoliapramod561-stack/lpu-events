# LPU Events — Development Foundation

This repository contains the development foundation for **LPU Events**, structured as a cross-platform monorepo using npm workspaces.

The structure consists of:
- `apps/student-web`: Student-facing web portal (Vite + React + TS, running on port `3000`)
- `apps/admin-web`: Administrative portal (Vite + React + TS, running on port `3001`)
- `packages/shared`: Shared packages and TypeScript definitions used by both apps
- `supabase`: Local Supabase CLI configuration, database migrations, and seed data

---

## 🛠️ Prerequisites

To run and develop this project locally, ensure you have the following installed on your machine:
1. **Git**: Version control
2. **Node.js**: LTS version (v18+)
3. **Docker Desktop**: Required to run the local Supabase container stack
4. **Supabase CLI**: Required for local database development (can be run via `npx supabase` without global installation)

---

## 🚀 Getting Started

Follow these steps to set up the development environment locally. These commands work identically on both **macOS and Windows**.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd lpu-events
```

### 2. Install Dependencies
Install all package dependencies and link workspaces from the repository root:
```bash
npm install
```

### 3. Configure the Environment
Create your local environment file from the template:
- **macOS/Linux**:
  ```bash
  cp .env.example .env
  ```
- **Windows (Command Prompt)**:
  ```cmd
  copy .env.example .env
  ```
- **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  ```

### 4. Start the Local Supabase Environment
Make sure **Docker Desktop** is open and running, then execute:
```bash
npx supabase start
```
This launches the database, auth server, API gateway, and local storage services inside Docker containers. It will automatically apply all migrations in `supabase/migrations/` and load the seed data from `supabase/seed.sql`.

### 5. Start the Applications
Open separate terminal windows and run the apps from the root:
* **Start Student Website**:
  ```bash
  npm run dev:student
  ```
* **Start Admin Website**:
  ```bash
  npm run dev:admin
  ```

---

## 🌐 Development URLs

Once started, the following local URLs will be accessible:

* **Student Website**: [http://localhost:3000](http://localhost:3000)
* **Admin Website**: [http://localhost:3001](http://localhost:3001)
* **Supabase Studio (Local Dashboard)**: [http://localhost:54323](http://localhost:54323)
* **Supabase API Gateway**: [http://localhost:54321](http://localhost:54321)

---

## 💾 Database Local Development

The database schema is fully managed and version-controlled via migrations. **Do not make manual changes via the database dashboard or local PG Admin.**

### Key Supabase CLI Commands
All Supabase commands can be run with `npx supabase` to ensure consistency:

* **Start environment**: `npx supabase start`
* **Stop environment**: `npx supabase stop`
* **Reset database schema & reseed**: `npx supabase db reset`
  *(Use this when you want to wipe local changes and restore the database to the state defined by migrations and seed data)*
* **Check database status**: `npx supabase status`

### Migration Strategy
1. To make schema changes, create a new migration file:
   ```bash
   npx supabase migration new <migration_name>
   ```
2. Write your SQL statements in the newly created migration file under `supabase/migrations/`.
3. Test your migration by resetting the local database:
   ```bash
   npx supabase db reset
   ```
4. Commit the migration files under `supabase/migrations/` to Git.

---

## 💻 Cross-Platform Compatibility & Commands

All scripts and workflows in this monorepo are designed to be completely cross-platform:
- **Build**: `npm run build:student` / `npm run build:admin`
- **Linting**: `npm run lint`
- **Type Checking**: `npm run typecheck`
- **Automated Tests**: `npm test` (Vitest test suite)
- **Lighthouse CI**: `npm run lhci` (Performance, CWV, Accessibility, SEO budgets)

---

## 📊 Observability, Analytics & Uptime Monitoring

Detailed documentation for the production observability stack (PostHog, Microsoft Clarity, Sentry, Better Stack, Cloudflare, and Supabase) is available at:
👉 **[OBSERVABILITY_ARCHITECTURE.md](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/docs/technical/OBSERVABILITY_ARCHITECTURE.md)**

