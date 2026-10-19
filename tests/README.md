# DOT-C independent acceptance checks

Run from repository root with Node.js 18+:

    node --test tests/*.test.cjs

No dependencies, network or build step. Renderer checks use a mocked Canvas context and deeply frozen snapshots. They verify all four modes, no mutation or input handlers, state-stack balance, timer text, circuit labels, and solution secrecy. These are not pixel or keyboard tests.

Level checks load the actual `src/levels.js` when integrated; otherwise they are explicitly SKIPPED. They validate bounds/entities, five levels, safe initial spawn and cardinal tile-center reachability with safe switching. They search all eight fixed circuit states for static bypasses. This is an independent discrete model, not proof of continuous collision behavior or the supplied solution sequence.

## Actual browser acceptance (CORE integration owner)

- Open root index.html offline; no missing resources or console errors.
- Enter starts; WASD moves; diagonals are normalized and cannot cross corners/walls/closed doors.
- Hold J/K/L: each fresh keydown changes its circuit once; labels A/B/C remain legible and match obstacles.
- Cross all five levels with switching and staging; confirm every exit advances and fifth wins.
- Trigger traps and close a door on the player: reset spawn/circuits, increment resets, preserve total active timer. R behaves identically.
- Hold movement, blur window, return: no stuck key, paused timer, explicit Enter resumes.
- Win freezes timer. Enter new game resets timer and counters.
- Inspect menu/playing/paused/won at 960×640 and at narrow viewport. Mobile layout is responsive, but gameplay needs a physical keyboard; no touch support is claimed.
- Canvas content is visual; screen-reader equivalent gameplay is not implemented.

Report actual executed checks separately from pending checks. Never call static, mocked or screenshot checks a completed playtest.
