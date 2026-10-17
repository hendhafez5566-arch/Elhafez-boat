# Booking retirement and CI remediation — 2026-10-18

Owner authorization: remove the obsolete reservation product; keep chatbot and security coverage active. This is source retirement, not changing assertions until a booking system passes.

| Retired source/tests | Reason | Current coverage/contract |
|---|---|---|
| services.ts program creation, booking snapshots/capacity/confirmation/cancellation | These operations no longer belong to the product | services.ts retains actor/RBAC/tenant transaction primitives; services.test.mjs tests current catalog tenant binding and permission denial |
| booking-choice.ts, flows.ts, meta/booking-flow-template.json | Old reservation forms and room selection | Generic version-pinned chatbot engine, questions, handoff, channels and delay scheduler |
| contracts/menu.ts + workflow.ts and their three test files | Hardcoded travel categories, provisional bookings, program pagination | Generic-flow and chatbot-runtime regressions validate supported choices, actual catalog pagination, snapshots and rejection of forged actions |
| obsolete services.test.mjs booking cases | Nine cases called removed APIs; four previously failed | Two transaction/RLS-scope tests retained; three generic authorization/tenant-binding cases replace retired service assumptions |
| old operations.js + old dashboard/demo HTML/JS | Dormant reservation/inventory forms and fake tourism records | Clean modular app/workspace/extensions, real authenticated API data and labelled flow preview |

Unchanged security foundation: auth.test.mjs, password/token code, RLS transaction boundaries, signed Meta webhook logic, SSRF protections, scoped access-key authorization. Existing CI still discovers all `tests/*.test.mjs`; no skip/todo/continue-on-error, ignored failures or excluded chatbot tests were added. The PostgreSQL gate now also checks FORCE/RLS flags on new runtime tables.

Historical SQL migrations and existing reservation data are preserved. Existing old HTTP route families remain explicitly retired with 410. Clean builds delete only the fixed `.build/` output directory so retired compiled files cannot remain in deploy artifacts.

No local final acceptance campaign was run during implementation. Existing GitHub CI may run automatically after push; report its exact commit/result separately. A green unit CI would not establish browser, live Meta, performance or restore acceptance.
