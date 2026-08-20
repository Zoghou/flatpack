# FLATPACK — game plan

## 1. Answer to "can this be done in HTML?"

Yes, and with no build step and no backend.

* 3D runs on **WebGL2 via Three.js** inside a `<canvas>`. Every browser released in
  the last decade can do it.
* The whole game ships as **static files**: `index.html`, ES modules, a vendored
  copy of Three.js (`games/flatpack/vendor/`, MIT). No npm install, no bundler, no
  server logic, no network at runtime.
* The only requirement is that the files are served over `http://` rather than
  opened as `file://`, because ES modules are subject to CORS. A small zero
  dependency static server (`serve.mjs`) is included for that.
* Saves live in `localStorage`. Everything else is in memory.

Physics: we deliberately do **not** ship a rigid-body engine. Flat-pack assembly
is a *constraint* problem, not a dynamics problem — parts snap to authored slots
and the interesting simulation is the fastener/rigidity model, which is cheap,
deterministic and testable. The end-of-build "wobble test" is a scripted
deformation driven by the rigidity numbers, not a solver.

## 2. What the game is

You find a flat, you buy furniture, you build the furniture, you live with the
consequences. The heart of it is the middle bit: an assembly simulator that
takes the instruction booklet seriously.

**The pitch for engineering enthusiasts:** it is not a click-the-glowing-thing
game. Parts have real pre-drilled hole patterns. A panel placed upside down
still *fits* — its holes just do not line up, and you find out two steps later.
Fasteners have torque bands: under-tighten and the carcass racks, over-tighten
and you strip the cam housing and lose that joint's stiffness for good. The HUD
shows a live **constraint readout** — how many degrees of freedom each part still
has — so you can watch a subassembly go from "floppy" to "rigid" as the second
non-collinear fastener lands. The back panel is what squares the cabinet, and if
you nail it on while the frame is racked, the wobble test at the end tells you
exactly how much.

### The four phases

| Phase | What you do | Why it's there |
|---|---|---|
| **Flat hunt** | Compare listings: rent, floor area, ceiling height, door width, radiator and window positions, quirks. Pick one, which fixes your budget. | Sets constraints that bite later. A 2.10 m ceiling means the 2.36 m wardrobe cannot be stood up in the room. |
| **Shop** | Browse the catalogue. Each product lists dimensions, price, part count, fastener mix and a difficulty rating. Live checks: fits the room, fits the budget, fits through the door, stands up under the ceiling. | Turns a shopping list into a packing problem. |
| **Build** | The main game. Per kit: unpack, verify the bill of materials, follow the step graph, pick the right part, orient it correctly, pick the right tool, hit the torque band. | The reason the game exists. |
| **Furnish** | Place the finished pieces in the room. Clearance rules: door swings, drawer pull-out, walkways, don't block the radiator or the window. | Pays off phase 1 and makes the build feel like it was for something. |

## 3. MVP scope (this milestone)

One flat type — **a one-bedroom** — and its bedroom.

* A flat hunt with 3 listings (one of them a trap: cheap, but a low ceiling).
* A catalogue of buildable kits plus non-buildable props.
* **3 buildable kits**, sharing one engine, authored purely as data:
  * `TÖRNBY` nightstand — the tutorial. Panels, dowels, cam locks and screw-in
    legs. Teaches orientation, torque, and the square-then-back-panel rule.
  * `KLÄDVIK` wardrobe — the main event. Carcass, shelf, rail and a door on two
    cup hinges, including a hinge-adjustment step where you dial the door gap
    to spec.
  * `NATTLIG` bed frame — rails, headboard, footboard and a batch of slats;
    introduces batched steps and a load-bearing rigidity check.
* Full build loop: BOM check, step graph, ghost placement with orientation,
  tool selection, torque/strike minigames, damage model, rigidity readout,
  wobble test, engineering report card.
* Wordless instruction booklet, rendered as line art from the *same* geometry
  the game uses — so it can never go out of sync with the model.
* Furnish phase with clearance scoring.
* Save/resume.

### Explicitly out of scope for the MVP

Multiple flats and room types (the data model supports them; only one is
authored), drawers with runners, real CSG hole cutting, multiplayer, sound,
localisation, mobile touch controls beyond basic orbit.

## 4. Expansion path

In order of cheapest-and-highest-value first:

1. **More kits** — pure data, no engine work: chest of drawers (runners),
   bookshelf (shelf pins, wall anchor), desk (cable management).
2. **More flats and rooms** — studio, two-bed, a kitchen (worktop cutting), a
   bathroom (plumbing tolerances).
3. **Damaged/missing parts** — the classic: one cam lock short, do you improvise?
4. **Timed "flatpack rush"** and racing your own ghost.
5. **Kit designer** — expose the authoring DSL in-game; kits are just data.
6. **Wall fixing** — stud finding, anchor selection by wall type, tip-over
   moment calculation. Very much on-theme.

## 5. Risks and how the design defuses them

* *Clicking through a wordless booklet is boring.* → Failure has to be possible
  and legible. Wrong orientation, wrong tool, wrong torque and wrong order all
  have distinct, visible consequences that surface later, not instantly.
* *3D placement is fiddly.* → No free-form dragging. Parts snap to authored
  slots; the only spatial decision is **orientation**, chosen from a small set,
  and it is decided by reading the hole pattern.
* *Content authoring explodes.* → Hole patterns are **derived from the joints**,
  never hand-placed. Authoring a kit means listing panels, slots and joints;
  geometry, booklet art and validation all fall out of that.
* *Perf.* → A few hundred meshes, no physics, render on demand. Trivial for WebGL.
