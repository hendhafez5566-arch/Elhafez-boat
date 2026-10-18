# Elhafez Boat — Visual Studio UI refresh

The Flow Builder now has an RTL block palette, a central draggable canvas, and a step inspector with an instant message-format preview. The actual engine conversation simulator stays in its own inspector panel. Snippet and linked-subflow tools are preserved in a collapsible advanced section. Core editor IDs and server payloads are unchanged.

The update reuses the existing flow schema, engine, tenant boundaries, draft/publish/version/rollback behavior and all provider adapters. Block previews are visual-only; they neither execute the bot nor send messages. On narrow screens the canvas is shown first and tools are stacked.

Chromium acceptance now checks the new palette, LIST and BUTTONS visual samples, and a synthetic drag/drop event within a real browser before continuing the existing wizard, save and publish acceptance. This does not certify physical touch ergonomics, a full accessibility audit, or all actions. Confirm CI for the final SHA. No deployment, Meta account, WhatsApp number, Railway service or additional billing was activated.
