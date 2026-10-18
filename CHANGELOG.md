# 2026-10-18 — WhatsApp pilot preparation

- Validate phone belongs to supplied WABA; fail closed on malformed/oversized/redirected provider replies.
- Reconnect only within original tenant, preserving account and conversations; verify routing ownership.
- Owner-only live read diagnostic for phone/WABA and exact Meta app subscription, without claiming message delivery.
- Arabic setup, explicit disconnect scope, unsaved-draft close/logout protection.
- HTTPS staging overlay and runtime configuration; hosting and Meta activation require separate owner consent.
- Add onboarding regression and real-PostgreSQL reconnect/diagnostic acceptance cases.

