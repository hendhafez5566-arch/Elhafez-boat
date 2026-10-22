# Safe offline contracts — 21 October 2026

Starts49e5caa on the same branch/PR5. No migrations, external providers, messages or deployment. Matrix remains30 PASS /6 PARTIAL /0 wholly BLOCKED.

F23: existing durable request worker supports JSON(default), TEXT→{text}, NONE→{}, optional safe response envelope {body,headers}. Fixed request headers limited to accept,accept-language,x-client-version; no templates/control characters/credentials. Response headers allowlisted and bounded, cookies excluded. Existing64KiB response limit, typed mapping and one-attempt POST/UNCERTAIN recovery remain. Native connector UI retains normalized JSON contract. Live/crash/load qualification remains separate.

F24: authenticated owner/manager export compiles a pinned WhatsApp Flow7.3 component subset (SingleColumnLayout/Form/TextInput/Footer), bounded navigation and prior-screen data propagation. Explicit requiresMetaValidation=true, approved=false, no assetID, endpoint or data exchange. This is local compilation, not provider approval or a claim of full/latest Meta schema compliance. Internal form draft/save unchanged.

F29/F30: deterministic MOCK only, owner/manager, serialized100 proposals/tenant/day, quota checked before generation,24h review window, actor/tenant/hash scoped accept/reject, idempotent repeated decisions and conflicting-decision rejection. Review never saves/publishes. UI acceptance remains normal undoable draft with stale-original guards. Audit stores task/length/hash/IDs, never prompt/output; metadata retention90days. EXTERNAL hard denied; no real AI adapter enabled. Live AI and provider qualification remain PARTIAL.

Validation:246 unit tests +TypeScript/build;20 durable integration PostgreSQL scenarios,3 governance PostgreSQL scenarios with NOSUPERUSER/NOBYPASSRLS and cross-tenant rejection;2 actual Chromium desktop/mobile scenarios. Evidence ../../evidence/offline-contracts-2026-10-21/. No physical device claim.

CI49e5caa run39604041473 exposed a preexisting stale-notice wait in tests/bots-browser.mjs: its second save could read first save success and fetch old draft. Clear prior notice before the actual click; retain actual BUTTONS count, publish and reload assertions. All other prior CI gates passed, including500-node/bilingual/context/media tests. Current full runtime rerun is recorded separately; never treat failed CI as green.

Next: major visual reconstruction with same-fixture before/after screenshots; keep physical-device/accessibility and real-provider limitations explicit.
