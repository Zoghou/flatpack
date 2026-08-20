// Phase 1 — the flat hunt. Pure DOM. Picking a flat fixes the room you will be
// building in and the money you have left for furniture.

import { APARTMENTS } from '../content/apartments.js';
import { money } from '../core/util.js';
import { h, svg as svgEl } from '../ui/dom.js';

export function mountApartment({ root, onChosen }) {
  const el = h('div', 'screen apartments');
  el.append(header());
  const grid = h('div', 'listing-grid');

  for (const a of APARTMENTS) {
    const card = h('article', 'card listing');
    const shot = h('div', 'shot');
    shot.style.background = `linear-gradient(150deg, ${a.photo[0]}, ${a.photo[1]})`;
    shot.append(plan(a));
    const body = h('div', 'listing-body');
    body.innerHTML = `
      <h3>${a.name}</h3>
      <p class="muted">${a.line}</p>
      <div class="figures">
        <div><b>${money(a.rent)}</b><span>per month</span></div>
        <div><b>${a.area} m²</b><span>total</span></div>
        <div><b>${money(a.budget)}</b><span>left for furniture</span></div>
      </div>
      <table class="spec">
        <tr><th>Bedroom</th><td>${a.bedroom.w} × ${a.bedroom.d} mm</td></tr>
        <tr><th>Ceiling</th><td>${a.bedroom.ceiling} mm</td></tr>
        <tr><th>Door</th><td>${a.bedroom.door.width} mm, opens ${a.bedroom.door.swing.replace('-', ' ')}</td></tr>
        <tr><th>Window</th><td>${a.bedroom.window.width} mm on the ${a.bedroom.window.wall} wall</td></tr>
      </table>`;
    const quirks = h('ul', 'quirks');
    a.quirks.forEach((q) => quirks.append(h('li', null, q)));
    body.append(quirks);
    const btn = h('button', 'btn primary', 'Take this one');
    btn.onclick = () => onChosen(a);
    body.append(btn);
    card.append(shot, body);
    grid.append(card);
  }

  el.append(grid);
  root.append(el);
  return { unmount: () => el.remove() };
}

function header() {
  const d = h('div', 'screen-head');
  d.innerHTML = `<h1>Find somewhere to live</h1>
    <p>Cheaper rent means more money for furniture and a worse room to put it in.
       Read the bedroom specification: the ceiling height and the door width decide what you can buy later.</p>`;
  return d;
}

/** Little top-down floor plan of the bedroom, drawn to scale in SVG. */
function plan(a) {
  const b = a.bedroom;
  const S = 0.038;                     // mm -> px
  const w = b.w * S, d = b.d * S;
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', `-14 -14 ${w + 28} ${d + 28}`);
  svg.setAttribute('class', 'plan');
  const rect = (x, y, ww, hh, cls) => {
    const r = svgEl('rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', ww); r.setAttribute('height', hh);
    r.setAttribute('class', cls);
    svg.append(r);
  };
  rect(0, 0, w, d, 'plan-room');
  const onWall = (wall, at, width, cls) => {
    const l = width * S, p = at * S;
    if (wall === 'north') rect(p - l / 2, -3, l, 6, cls);
    else if (wall === 'south') rect(p - l / 2, d - 3, l, 6, cls);
    else if (wall === 'west') rect(-3, p - l / 2, 6, l, cls);
    else rect(w - 3, p - l / 2, 6, l, cls);
  };
  onWall(b.window.wall, b.window.at, b.window.width, 'plan-window');
  onWall(b.radiator.wall, b.radiator.at, b.radiator.width, 'plan-radiator');
  onWall(b.door.wall, b.door.at, b.door.width, 'plan-door');
  const t = svgEl('text');
  t.setAttribute('x', w / 2); t.setAttribute('y', d / 2);
  t.setAttribute('class', 'plan-label');
  t.textContent = `${(b.w / 1000).toFixed(1)} × ${(b.d / 1000).toFixed(1)} m`;
  svg.append(t);
  return svg;
}
