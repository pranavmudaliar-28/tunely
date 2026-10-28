# Decisions

Choices made while building, newest last.

- **TypeScript 6.0.3, not 7.x.** TS 7 (native port) is the latest release, but typescript-eslint 8.72 supports only `<6.1.0` and needs the TS compiler API. Revisit when typescript-eslint supports 7.
- **Internal packages ship TypeScript source.** `@tunely/shared` and `@tunely/db` export `src/index.ts`. Next.js transpiles them (`transpilePackages`); the API and worker run with `tsx` in dev and are bundled with esbuild for production, so no per-package build step or watch process is needed.
- **`moduleResolution: Bundler` everywhere.** Every runtime path goes through a bundler or tsx, so extensionless imports work and Next/Turbopack resolves them the same way.
- **pnpm installed with `npm i -g pnpm`.** `corepack enable` fails without admin rights on Windows (EPERM in Program Files).
- **Postgres on host port 5433 locally.** 5432 is often taken by other projects; override with `POSTGRES_PORT`.
