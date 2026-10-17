# CURRENT STATUS — 2026-10-17

Stage 0: IN PROGRESS. Repository PUBLIC by explicit owner choice until later. Branch: feat/stage0-foundation; PR #1 draft.
Code on branch: workspace skeleton, TS contracts, dev-only API/web/worker placeholders, Docker Compose, Postgres migration 0001_initial.sql with tenant-scoped programs/bookings and RLS, pure workflow menu engine with company-filtered published catalog and human handoff, 11 written Node tests total, CI workflow.
VERIFICATION: GitHub file writes confirmed; tests have NOT been run against checked-out repository and CI status is not verified. Git clone from execution container failed (DNS unavailable). Database migration NOT applied to PostgreSQL. No real login/auth, persistent API, WhatsApp connection, Flows, bookings UI, AI, or deployment. No lockfile.
NEXT: verify npm install && npm run check in accessible environment; fix failures and commit lockfile. Run migration against PostgreSQL with non-owner role, test RLS, then build authenticated CRUD and booking transaction; do not mark Stage 0 complete prematurely.
