# Save lease CI repair — 21 October 2026

Verified remote HEAD 0e4baf59b179eceedfecd93bc1163cda67a94bab before changes; same branch and Draft PR #5. Read both actual Actions runs: 39559288577 succeeded, 39559283938 failed only at flow-save-browser.mjs tab-close reacquisition (job 119086389746). The application save/lease/CAS checks passed before that assertion.

The assertion sampled navigator.locks.query(), then requested ifAvailable in another browser IPC operation. A snapshot is not an acquisition acknowledgement during document teardown. Replace this check with a bounded queued exclusive request, prove it cannot acquire while the original tab holds the lock, close that tab, require actual acquisition within five seconds, then require immediate fresh acquisition after release. No sleep, removed acceptance, application change or weakened timeout. Original standalone 100-close reproduction and initial full browser run passed locally; the intermittent original CI timing is observed in the remote log, not claimed as a local natural failure.

Validation: npm run check PASS (201 tests, zero skipped; TypeScript/build); fresh PostgreSQL 16 migrations 0001–0040; 11 controls/consent and six save scenarios PASS with non-BYPASSRLS role; corrected save Chromium desktop/mobile suite PASS twice. New isolated screenshots/results: ../../evidence/save-repair-2026-10-21/. Matrix bottom totals corrected to match all 36 rows: 18 PASS / 18 PARTIAL / 0 wholly BLOCKED.

Next: channel event triggers and priority conflicts, native input/channel component gaps; preserve old pinned flows and human/consent guards. Visual approval pending; no deployment/provider/customer sends.
