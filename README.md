# FLATPACK

A flat-pack furniture assembly game in the browser. Find a flat, buy the
furniture, **build it properly**, then live with the result.

```bash
npm start        # then open http://localhost:5174/
```

Nothing to install. Static HTML, ES modules and a vendored copy of Three.js
(MIT, `vendor/`); the little server exists only because ES modules will not load
from `file://`.

**Read `docs/PLAN.md` for what the game is and `docs/ARCHITECTURE.md` for how it
is put together.** The phases in the plan land one commit at a time.

**Phase 1 — the flat hunt** is in: three listings with rent, floor area, ceiling
height, door size, stairwell access and the quirks that bite later. Cheaper rent
buys you more furniture and a worse room to put it in, and one of the three is a
trap.
