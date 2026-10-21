# Actual Chromium visual acceptance — 21 October 2026

Same synthetic bot ID is recorded in both results.json files. Same11-node tourism graph and saved layout, Arabic,100% zoom,1440×1000, welcome inspector open. Mobile390×844 preserves the same inspector. Large graph: same500 nodes/499 edges, same17 minus-button presses after100%. Baseline source:2f0f77c. Original hidden-overflow browser scrolling could shift the visible baseline area despite the same focus command; new overflow:clip prevents that drift. No generated images or competitor assets.

| View | Original HEAD | Rebuilt UI |
|---|---|---|
| Workspace | [Before](before/01-workspace.png) | [After](after/01-workspace.png) |
| Node cards | [Before](before/02-node-cards.png) | [After](after/02-node-cards.png) |
| Connectors | [Before](before/03-connectors.png) | [After](after/03-connectors.png) |
| Library | [Before](before/04-library.png) | [After](after/04-library.png) |
| Inspector | [Before](before/05-inspector.png) | [After](after/05-inspector.png) |
| Message editor | [Before](before/06-message-editor.png) | [After](after/06-message-editor.png) |
| Condition editor | [Before](before/07-condition-editor.png) | [After](after/07-condition-editor.png) |
| Simulator | [Before](before/08-preview.png) | [After](after/08-preview.png) |
| Mobile inspector | [Before](before/09-mobile.png) | [After](after/09-mobile.png) |
| 500 nodes | [Before](before/10-large-graph.png) | [After](after/10-large-graph.png) |

Node/connector crops show the same full canvas independently. `package-a`/`package-c`/`package-d` are intermediate presentation-only captures with a6-node preset, not final matched/runtime evidence. `attempts/` retains a failed pre-fix capture. Final real API suites: regression-premium28; after7; regression-scale4; regression-context3; regression-authoring5; regression-offline2 + regression-replay6 =55 Chromium checks, no page errors. PostgreSQL suites:3 scale +10 authoring +4 context +3 governance =20 scenarios. TypeScript/build246 unit tests PASS. See individual logs and results files; physical touch/screen readers/live providers remain unqualified.

CI first checkpoint c00abfe: checks succeeded; browser job failed because the old offline test clicked a newly nested summary without opening its menu. Navigation helper now opens actual disclosure controls and preserves all original assertions. Rerun of the complete failed offline suite passes locally; latest source CI must be assessed independently.
