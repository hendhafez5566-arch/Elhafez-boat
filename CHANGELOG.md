# 2026-10-18 — Permanent WhatsApp company self-service

Embedded Signup with owner/browser/tenant-bound one-use grant, encrypted phone choice, WABA/phone/app/scope validation, subscription checks; Arabic Cloud/Coexistence UI; consent-gated sync/registration; app echo/history/contact/account lifecycle and no-history service-window extension; migration 0028 RLS; real API/DB/browser fixture acceptance; local no-hosting profile. Flags remain off without official Meta setup/approval. No external accounts connected or costs created.

# 2026-10-18 — WhatsApp pilot preparation

- Validate phone belongs to supplied WABA; fail closed on malformed/oversized/redirected provider replies.
- Reconnect only within original tenant, preserving account and conversations; verify routing ownership.
- Owner-only live read diagnostic for phone/WABA and exact Meta app subscription, without claiming message delivery.
- Arabic setup, explicit disconnect scope, unsaved-draft close/logout protection.
- HTTPS staging overlay and runtime configuration; hosting and Meta activation require separate owner consent.
- Add onboarding regression and real-PostgreSQL reconnect/diagnostic acceptance cases.

