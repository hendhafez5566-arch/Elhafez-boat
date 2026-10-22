# Meta Commerce verification — 2026-10-18

Source [c2487df](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/c2487dfb0673f3a53d477dfcb53b9507c36b1975), starting from 5c03106. Same working branch and draft PR #1, no merge/deployment.

## Observed development checks

- Local clean build/TypeScript, JS syntax, DOM references/unique IDs, whitespace and real HTTP dashboard/current Commerce assets — PASS.
- Local npm test: **70 tests, 70 pass, 0 fail, 0 skipped**.
- GitHub [push run 39103361252](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39103361252) — SUCCESS; [PR run 39103364082](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39103364082) also SUCCESS.
- Job **117603998394** logs read directly: **70/70**, `Applied migration 0025_meta_commerce.sql`, PostgreSQL isolation/RLS gate PASS.
- Actual PostgreSQL test creates a company-scoped Commerce mapping, proves another company cannot read/insert it, then executes the cart-as-interest handler and asserts READY_FOR_AGENT/HUMAN and absence of inbound spoofed price in lead fields. All fixture data is in a rolled-back disposable CI transaction.
- Unit cases cover official SPM/named variables, catalog action, MPM limits/duplicates/thumbnail, 2–10 product cards from a two-card approved prototype, approved URL buttons, mixed catalog/media rejection, direct provider-parameter injection, tenant/account mapping checks, live-verifier contract with provider test doubles, phone/WABA association, rejected products/hidden catalog and rendered text bounds. Prior chatbot/auth/security tests remain enabled.

## Limits of evidence

Provider contract unit cases use explicit test doubles; no real Meta credentials/catalog/account was connected. Live Meta catalog/product approval/visibility/permissions/template delivery is NOT VERIFIED. No authenticated browser/mobile screenshot, worker fault/load, backup/restore or full comprehensive acceptance PASS. Read docs/20-META-COMMERCE.md for setup and precise supported shapes. Apply migration 0025 and runtime-role grants; no real secret is committed.
