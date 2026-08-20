// The title card. Also the only screen that knows how to describe the game, so
// it is the one place to look when you want to remember what it is for.

import { APARTMENTS } from '../content/apartments.js';
import { h } from '../ui/dom.js';

export function mountTitle({ root, onNew, onResume, resumeLabel }) {
  const el = h('div', 'screen title');
  const card = h('div', 'title-card');
  card.innerHTML = `
    <h1>FLATPACK</h1>
    <p class="tagline">Find a flat. Buy the furniture. Build it properly.</p>
    <p class="pitch">An assembly simulator that takes the instruction booklet seriously: real hole
      patterns, real fastener torque, and a constraint readout that tells you exactly how many
      degrees of freedom each panel has left.</p>`;

  const row = h('div', 'title-actions');
  const cont = h('button', 'btn primary', resumeLabel ?? 'Continue');
  cont.disabled = !onResume;
  cont.onclick = () => onResume?.();
  const fresh = h('button', 'btn', 'New game');
  fresh.onclick = () => onNew();
  row.append(cont, fresh);
  card.append(row);

  const keys = h('div', 'title-keys');
  keys.innerHTML = `<b>Controls</b>
    <span>drag — orbit</span><span>wheel — zoom</span><span>1–5 — pick a tool</span>
    <span>R — turn the part</span><span>Tab — next position</span><span>E — exploded view</span>
    <span>hold the mouse on a fastener to drive it</span>`;
  card.append(keys);

  const flats = h('div', 'title-flats');
  APARTMENTS.forEach((a) => flats.append(h('span', 'chip', a.name)));
  card.append(flats);

  el.append(card);
  root.append(el);
  return { unmount: () => el.remove() };
}
