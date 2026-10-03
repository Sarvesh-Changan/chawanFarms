# Chawan Farms

Chawan Farms is a Next.js App Router scaffold for the agri-tourism platform. This phase contains route placeholders, shared tokens, environment validation, and developer-quality tooling. Business features are intentionally not implemented yet.

## Setup in under 15 minutes

Requirements: Node.js 22 or newer and npm.

```bash
git clone <repository-url>
cd ChawanFarms
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. The health endpoint is <http://localhost:3000/api/health>.

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env.local
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format
```

The Playwright smoke test starts a local Next.js server automatically. Install Playwright browsers once if needed:

```bash
npx playwright install
```

Husky runs lint-staged before commits and commitlint checks Conventional Commit messages. Replace `@REPLACE_WITH_REVIEWER` in `.github/CODEOWNERS` with the real GitHub user or team before relying on protected-path review enforcement.

## Environment

Only `NEXT_PUBLIC_SITE_URL` and `APP_ENV` are currently supported. Copy `.env.example`; do not commit `.env.local` or secrets.

## Current scope

There is no Prisma schema, database, authentication provider, payment integration, or Cloudinary integration in this scaffold. Refer to `docs/BUILD_GUIDE.md` for the phased implementation plan.
