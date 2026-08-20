# FLATPACK — architecture

Static ES modules + Three.js. No build step. `index.html` is the only entry
point; everything under `src/` is loaded as native modules through an import map
that points bare `three` at the vendored copy.

```
games/flatpack/
  index.html          import map, canvas, HUD skeleton
  serve.mjs           zero-dependency static server (npm run game)
  css/app.css
  vendor/             three.module.min.js, three.core.min.js, OrbitControls.js (MIT)
  docs/               PLAN.md, ARCHITECTURE.md
  src/
    main.js           boot + phase router
    core/             bus.js, store.js, util.js
    content/          kits/*.js, apartments.js, catalog.js, hardware.js
    sim/              assembly.js, rigidity.js, scoring.js
    render/           scene.js, partmesh.js, hardwaremesh.js, booklet.js
    phases/           apartment.js, shop.js, build.js, furnish.js
    ui/               hud.js, bom.js, toolrack.js, gauge.js, report.js
```

## Layering

```
        content (pure data)
              |
   sim  <-----+-----> render          neither knows about the DOM / the other
    |                   |
    +------- phases ----+             phases own the wiring for one screen
              |
             ui                       DOM only, talks through the bus
              |
            store                     single mutable game state + localStorage
```

Rules that keep it honest:

* `sim/` is **pure**: no Three.js, no DOM. It takes a kit and player actions and
  returns state and events. That is what makes the assembly rules testable
  without a browser.
* `render/` never decides anything; it draws whatever `sim/` says is true.
* `content/` is data only. Adding a kit must never require touching the engine.
* Cross-module communication is the event bus (`core/bus.js`); phases subscribe
  and tear down on exit.

## Units and frames

* Authoring is in **millimetres, Y up**. The renderer multiplies by `MM = 0.001`.
* Each part has a local frame: `size = [x, y, z]` centred on the origin.
* A **slot** is a named position in the finished assembly: `pos` (mm) and `rot`
  (degrees, XYZ order). The finished piece is the union of its slots.

## The one idea that makes content cheap: holes are derived from joints

Nothing hand-places a hole. A kit author writes panels, slots and **joints**; a
joint knows its position in assembly space, its axis and its two slots. At load
time `sim/assembly.js` transforms every joint position into the local frame of
each participating slot using that slot's *correct* transform, and that is the
hole pattern. Three things fall out for free:

1. **Geometry** — `render/partmesh.js` sinks a recessed disc (or a through hole)
   at each derived feature, so the panel you see carries the real pattern.
2. **Validation** — when the player places a panel in a wrong orientation, the
   baked-in holes no longer coincide with the joint positions. The mismatch is
   computed, not authored, so it can never disagree with the art.
3. **The booklet** — the instruction diagram is rendered from the same meshes
   through an orthographic camera with edge geometry, so the manual is always
   the truth.

## Data contracts

### Kit

```js
{
  id, name, product, price, difficulty,
  assembled: { w, d, h },              // mm, for the shop and the furnish phase
  parts:  [PartSpec], slots: [SlotSpec], joints: [JointSpec], steps: [StepSpec],
  clearance: [ZoneSpec],               // mm zones that must stay free when placed
}
```

### PartSpec

```js
{ id:'100234', name:'Side panel', kind:'panel'|'board'|'rail'|'leg'|'door',
  size:[x, y, z], material:'white'|'oak'|'hardboard'|'steel'|'plastic' }
```

### SlotSpec

```js
{ id:'side-l', part:'100234',
  pos:[x, y, z], rot:[rx, ry, rz],     // the CORRECT placement
  flips:['y180', 'x180'],              // decoy orientations, generated from rot
  anchor:true,                          // optional: this slot is the ground of the rigidity graph
  group:'carcass' }
```

The orientation options a player cycles through are `[correct, ...flips]`,
presented in a shuffled order. Reading the hole pattern is how you tell them
apart — that is the core skill of the placement mechanic.

### JointSpec

```js
{ id:'j-cam-1', type:'dowel'|'cam'|'screw'|'nail'|'hinge'|'legscrew'|'pin',
  a:'side-l', b:'bottom',              // a = the drive side (cam housing / screw head)
  pos:[x, y, z], axis:'x'|'y'|'z',
  pre:  { in:'b', driver:'mallet',  band:[0.45, 0.75], strip:0.9 } | null,
  lock: { in:'a', driver:'allen',   band:[0.55, 0.80], strip:0.92 } | null }
```

* `pre` is the operation you do to a loose part *before* mating: tapping a dowel
  in, running a cam bolt into an edge.
* `lock` is the operation you do *after* mating: turning the cam, driving the
  screw, tapping the nail.
* A dowel has `pre` only; a screw has `lock` only; a cam has both.

### StepSpec

```js
{ id:'s4', title:'…', requires:['s3'],
  op:'bom'|'insert'|'place'|'fasten'|'check'|'adjust'|'finish',
  slots:[…], joints:[…], tool:'allen', teach:'…' }
```

`requires` makes the step list a **DAG, not a queue**. Several steps are open at
once whenever the dependency graph allows it, which is what a real booklet
implies and a linear tutorial pretends is not true.

## Simulation

### `sim/assembly.js`

The runtime. Holds `placed`, `jointState`, `completed`, `stats`; exposes
`openSteps()`, `place(slot, orientationId)`, `drive(jointId, phase, power, tool)`,
`checkSquare()`, and emits typed events. All the rules live here:

* a part can only go in a slot the open steps allow;
* orientation correctness is measured against derived holes, with a 1 mm tolerance;
* driving with the wrong tool cams out — damage, and the joint's quality is capped;
* power below the band leaves the joint **loose** (retightenable, costs time),
  inside it is **good**, above `strip` is **stripped** (permanent, quality 0.3);
* a joint only becomes load bearing once both its slots are placed and its
  required phases are done.

### `sim/rigidity.js`

The engineering readout, recomputed after every action. Constraint budget per
part: each effective joint contributes constraints (dowel 2, cam 3, screw 3,
nail 1, hinge 2), scaled by joint quality; the remaining degrees of freedom are
`6 − Σconstraints`, floored at 1 if every constraint point is collinear — which
is exactly why one dowel is never enough and why two in a line still let a panel
pivot. Parts connected through effective joints to the anchor slot form the
rigid set; anything else is reported as floating.

Squareness is tracked separately: fastening the back panel while the carcass is
racked (any carcass joint still loose) bakes the error in permanently.

### `sim/scoring.js`

Time, torque precision, misplacement count, damage, leftover hardware, final
rigidity and squareness → a grade plus an itemised engineering report. No hidden
weighting; the report shows every term.

## Rendering

* One `WebGLRenderer`, one perspective camera on `OrbitControls`, render on demand
  (`requestRender()`), plus a continuous loop only while an animation is running.
* `partmesh.js` builds a panel as a `BoxGeometry` plus recessed hole discs; there
  is no CSG. A hole is a thin dark cylinder inset into the face, which reads
  correctly at every angle a player can reach and costs nothing.
* Ghost previews are the same geometry with a translucent material; anchors and
  joint sites are small emissive markers, raycast against for clicks.
* `booklet.js` owns a second scene and an orthographic camera, rendering the
  step's parts as `EdgesGeometry` line art on white, with an arrow for the
  insertion axis. It re-renders only when the step changes.

## Phase flow

```
apartment ──▶ shop ──▶ build (one kit at a time) ──▶ furnish ──▶ report
     ▲                    │
     └────────────────────┘  (state kept in the store, resumable from localStorage)
```

Each phase module exports `mount(root, store)` / `unmount()`. The router in
`main.js` owns exactly one mounted phase and the shared renderer.

## Save format

`localStorage['flatpack.save.v1']` holds the store's serialisable slice: chosen
flat, budget, owned kits with their per-kit build result, furnish layout and
settings. A build in progress is snapshotted per action, so a reload drops you
back into the same step.
