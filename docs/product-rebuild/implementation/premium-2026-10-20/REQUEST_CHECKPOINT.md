# F23 — request authoring and response contract checkpoint

Parent verified remote HEAD: a0c227d. Same branch and Draft PR #5. Contract-only checkpoint; **new response-waiting nodes cannot publish or execute live** until the durable worker is implemented. Existing fire-and-forget WEBHOOK nodes retain their behavior.

Adds bounded GET/POST settings, 1–30-second timeout, GET retry count 1–3 and POST fixed at one attempt, request field templates, safe own-property JSON path mapping (six levels, 25 fields, 500-character scalar values, 64-KiB response), typed atomic assignment, error/timeout graph ports and subflow binding. Credentials remain references to the existing integration secret store. Mock response fixtures are held outside the draft and never persisted or sent to a provider.

Validation actually run: npm run check — 166 PASS; existing flow-controls PostgreSQL suite — 14 scenarios PASS; dedicated real API/PostgreSQL-backed Chromium — three checks PASS (draft/editor roundtrip, shared-engine success/error/timeout, no persisted Mock and publication gate). Actual screenshots/results: ../../evidence/requests-2026-10-20/. Baseline GitHub CI for a0c227d: Verify run 39469517135 / 962 completed success.

F23 stays PARTIAL. Next coherent batch: use existing integration jobs to claim before dispatch, persist completion separately, resume only matching pinned wait token/version, prevent POST resend after uncertain outcomes, recover internal continuation without repeating HTTP, and verify deadline/takeover/tenant/role races with local transport mocks. No external provider activation or production deployment. Visual redesign remains deferred.
