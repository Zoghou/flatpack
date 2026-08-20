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

**Phase 4 — furnishing the room** is in: the pieces you built, in the bedroom of
the flat you took, checked against the clearances you would actually notice
living there — the door swing, room for the wardrobe door to open, the radiator,
the window.

**Phase 3 — the build** is the game. See "Why it is interesting
to build things in it" below.

**Phase 2 — the shop**: a catalogue where every product is checked live
against the flat you took — budget, floor area, ceiling, whether a tall carcass
can even be tilted upright in the room, and whether its longest board gets up
the stairs. The three buildable kits are already authored as data (panels, slots
and joints); the assembly engine that reads them is the next phase.

**Phase 1 — the flat hunt**: three listings with rent, floor area, ceiling
height, door size, stairwell access and the quirks that bite later. Cheaper rent
buys you more furniture and a worse room to put it in, and one of the three is a
trap.

## Why it is interesting to build things in it

* **Hole patterns are real.** Every hole is derived from the joint it belongs
  to, so a panel fitted the wrong way round still *fits* — its holes just miss,
  by an amount the game measures and shows you.
* **Fasteners have torque bands.** Hold to drive, let go inside the band.
  Under-tighten and the carcass racks; over-tighten and you strip the cam
  housing and lose that joint's stiffness permanently; use the wrong driver and
  you cam out the recess.
* **There is a live constraint readout.** Each part shows how many degrees of
  freedom it has left. One dowel leaves three. Two dowels in a line still leave
  a pivot. A cam clamps a face and kills the moment — which is exactly why the
  kit gives you both.
* **Order matters for real reasons.** The back panel is what squares the
  carcass. Pin it on while the frame is racked and the error is permanent, and
  the wobble test at the end will show you precisely how much.
* **The booklet is generated from the model.** The wordless step diagram is
  rendered as line art from the same geometry you are assembling, so it can
  never disagree with the game.

## Controls

| | |
|---|---|
| drag / wheel | orbit and zoom |
| `1`–`5` | hands, hex key, screwdriver, mallet, try square |
| click a part in the list | pick it up |
| `R` / `Tab` | turn the part / move to the next position |
| click the ghost or `Enter` | fit it |
| hold the mouse on a fastener | drive it — release inside the band |
| right-click a fitted part | take it out again (if nothing is fastened to it) |
| `E` | exploded view |

## Tests

```bash
npm test        # the assembly rules, headless, no browser needed
```

`sim/` is pure logic — no DOM, no Three.js — which is why the rules can be
tested this way. The suite checks each kit's data (every joint reachable by some
step, every decoy orientation actually detectable from the hole pattern), plays
a perfect run of all three kits, and plays a deliberately sloppy one to assert
it comes out racked and is graded down for it.
