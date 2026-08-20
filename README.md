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
is put together.** The phases in the plan land one commit at a time; this commit
is the scaffolding — the static shell, the shared 3D stage, the game state and
the title screen.
