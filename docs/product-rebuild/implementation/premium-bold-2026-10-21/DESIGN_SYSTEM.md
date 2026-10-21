# Elhafez Studio / Orbit

The source of truth is `apps/web/public/flow-builder.css`, with original SVG paths and component descriptions in `flow-presentation.js`. No competitor assets or external fonts are used. The chatbot engine/schema/provider contracts are outside this presentation change.

| Token group | Values / use |
|---|---|
| Brand | `#5b21b6`, hover `#47158f`, soft `#ede5ff`; primary action and selection |
| Command surface | `#24143f`; white text and `#e0d6f1` supporting text |
| Content | ink `#201b32`, secondary `#595267`, white and `#f7f5fb` surfaces |
| Canvas | `#eae8f1`; subdued violet dots, connector `#77608f`, selected violet |
| Semantic pairs | green `#126747/#d6f3e5`; amber `#824600/#ffebc2`; blue `#1956a8/#ddeaff`; rose `#a52244/#ffe0e8`; teal `#006b67/#d2f1eb`; violet `#5926ad/#eae0ff` |
| Type | Noto Sans Arabic, Segoe UI, Tahoma; 12/13/14/16/20px tokens; node titles16px, body15px, Inspector title18px |
| Space | 4/8/12/16/24/32px scale; 286px node geometry retained |
| Radius | 9/14/20px; bubbles and semantic cards use contextual corners |
| Depth | two shared shadows for resting/raised cards; selected3px border and outer halo |
| Icons | original24px SVGs, consistent strokes;44px node/42px tool containers |
| Responsive | 1200px compact header;800px drawers and single-column simulator;44px touch controls |
| States | semantic hover, violet focus ring, strong selected border, disconnected-route error badge; live simulator loading/error status |

The existing stylesheet is edited in place. Global Vessel control overrides are resolved with scoped source selectors, including actual app ancestry in the contrast fixture; no new override stylesheet is appended. Mobile rules remain scoped to existing breakpoints. Primary preview hover explicitly retains Orbit colors, including after pointer interaction.

`node tests/studio-contrast.mjs` renders all three production stylesheets in their actual order and checks183 text/icon/boundary pairs,27 distinct SVG paths and27 useful component descriptions. Text/icon pairs require4.5:1 and relevant field boundaries3:1. It is a computed CSS fixture, not a substitute for actual application interaction, an exhaustive accessibility certification or physical-device evidence. Real authenticated application screenshots and interactions are recorded separately. No generated fixture image is used as product evidence.
