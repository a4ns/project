# Integration contract v0 — proposal for team confirmation

## Scope
A small offline browser game, Canvas 2D top-down, plain JavaScript. Five levels, no remote services, accounts, paid APIs, CDN, network multiplayer or external assets. This contract is proposed; each team confirms it in HQ issue #1 before implementation. Do not independently expand scope.

## Files and ownership
- CORE / A: index.html, src/engine.js; final integration.
- LEVELS / DOT-B: src/levels.js.
- UI-QA / DOT-C: src/renderer.js, styles.css, tests/.
- Contract changes require coordination in #1. Separate feature branches and PRs; no force pushes or unrelated changes.
- index.html provides canvas#game and loads levels.js, renderer.js, engine.js in that order as ordinary scripts (no module loader required).

## Data
window.CoopLevels is an array of exactly five objects. Each has id, title, map, spawn, exit, circuits, doors, traps, hint and solution.
- id: unique string; title/hint: display strings.
- map: equal-width strings of # (wall) and . (floor), bounded by walls; maximum 24 columns and 16 rows.
- spawn/exit: {x,y} integer tile coordinates, origin top left.
- circuits: {A:0,B:0,C:0}; values are 0 or 1.
- doors: [{x,y,circuit:"A",openWhen:1}].
- traps: [{x,y,circuit:"B",activeWhen:0}].
- solution: ordered array such as ["A1","A0"], a reviewer hint, not shown in gameplay.
All entities lie on floor; spawn and exit are distinct; no overlapping obstacle entities. All three circuit keys always exist. Initial spawn must be safe.

## Engine behaviour
WASD moves the player; J/K/L toggle A/B/C on fresh keydown only (ignore repeated events). Enter starts the game / advances past victory to a new game; R resets the current level. Use KeyboardEvent.code. Clear held keys on blur and pause time while unfocused; resume after explicit Enter.
The player position uses tile units, centered at spawn x+0.5,y+0.5; radius 0.25. Normalize diagonal speed. Solid walls and closed doors block movement. Active traps cause reset. Closing a door or activating a trap overlapping the player also resets the level. Reset restores spawn and initial circuits, increments death/reset counter but does not clear total elapsed active-play time. Exit starts the next level; level five exit enters won state and freezes the timer. New game resets all counters.

## Render boundary
window.CoopView.draw(ctx,snapshot) renders only, with no state mutation or event handlers. Snapshot fields: mode ('menu','playing','paused','won'), levelIndex (0-based), level (the exact level object), player ({x,y,radius} tile units), circuits, elapsedSeconds, resets. Engine owns all state and input. Canvas intrinsic resolution 960x640, tile size 40 px, board centered. Renderer may show menu/instructions/HUD/victory inside Canvas; CSS owns surrounding visual presentation. Core provides a functional fallback view if needed for its isolated tests, not a competing final renderer.

## Level progression
1. Opposing doors A1 then A0, safe staging area between them.
2. Opposing B-controlled traps, safe staging areas.
3. Two circuits A1 → B1 → A0 → B0.
4. Mixed doors and traps with repeated switching.
5. Three circuits A1 → B1 → C1 → A0 → B0 → C0.
No route may bypass required obstacles; no fixed circuit configuration should solve a level. The design requires switching during traversal, not proof of two different human operators. Every map needs a verified traversal including staging positions; a switch sequence alone is insufficient proof.

## Acceptance
- Starts without external resources or console errors.
- Five complete playable levels, sequential exits and victory.
- Walls/closed doors block normal and diagonal movement.
- Key repeat toggles once; focus loss leaves no stuck keys.
- Trap/closing-door overlap and R reset correctly.
- Timer/counters follow the rules, freeze at victory and reset only for a new game.
- Every level has a reproducible solution and no bypass/static-state solution.
- Renderer consumes the specified snapshot without mutation.
- Test actual keyboard interaction; synthetic/static checks alone are not a completed playtest.

## Handoffs
Post role, branch/commit/PR, files changed, tests actually run, known limitations, next required action in HQ #1. Read new comments before posting; do not create acknowledgement loops. GitHub comment auto-wakeup is unverified. Do not copy private chats, secrets or personal data into this public repository.
