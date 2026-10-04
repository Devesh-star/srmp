<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CyberRisk: Project Rules for AI Coding Agents

Cybersecurity risk assessment and management dashboard.
Full spec: docs/ROADMAP.md. Read Section 2 "Risk Model" before touching any scoring code.

## Stack
Next.js App Router, TypeScript (strict), Tailwind, Recharts, MongoDB + Mongoose,
Auth.js v5 (next-auth@beta), Zod, bcryptjs, Vitest, @react-pdf/renderer.

## Hard rules
- All scoring logic lives in lib/riskEngine.ts as PURE functions. No database or
  framework imports there. Never duplicate scoring logic in components, routes or services.
- Every tenant collection has organizationId. Every query filters by it.
- Every API route: authenticate, check role (admin / assessor / viewer),
  validate input with a Zod schema in lib/validation/, scope by organizationId.
- Every write route calls lib/audit.ts.
- Residual likelihood and impact are stored as decimals; round only for display.
- No secrets in code or logs. Read them from environment variables. Never commit .env files.
- Do not modify lib/riskEngine.ts or its tests unless I explicitly ask.
- Prefer small files and simple code over clever code. Comment non-obvious logic.
- Do not install new dependencies without asking.

## Workflow
- Work on ONE slice at a time. Before coding, state a plan in 3-6 bullets and wait for
  my approval on anything that changes the data model.
- After coding, run: npm run lint, npm run typecheck, npm test. Report the actual output.
  Never claim something works without running it.
- Only touch files relevant to the current slice. Keep diffs small.
- At the end of each slice, list files changed and any decision not covered by the spec.

## Folder map
app/ (routes), components/, lib/ (riskEngine, audit, auth, validation),
models/, services/, data/ (library seed data), scripts/seed.ts, tests/
